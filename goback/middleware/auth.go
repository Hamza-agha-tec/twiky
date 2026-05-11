package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type AuthenticatedUser struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

// --- JWKS caching ---

type jwksCache struct {
	mu        sync.RWMutex
	keys      map[string]*ecdsa.PublicKey
	fetchedAt time.Time
}

var cache = &jwksCache{keys: make(map[string]*ecdsa.PublicKey)}

type jwksResponse struct {
	Keys []struct {
		Kid string `json:"kid"`
		Kty string `json:"kty"`
		Crv string `json:"crv"`
		X   string `json:"x"`
		Y   string `json:"y"`
	} `json:"keys"`
}

func getPublicKey(kid string, jwksURL string) (*ecdsa.PublicKey, error) {
	cache.mu.RLock()
	if key, ok := cache.keys[kid]; ok && time.Since(cache.fetchedAt) < time.Hour {
		cache.mu.RUnlock()
		return key, nil
	}
	cache.mu.RUnlock()

	// Fetch fresh JWKS
	resp, err := http.Get(jwksURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	var jwks jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, fmt.Errorf("failed to decode JWKS: %w", err)
	}

	cache.mu.Lock()
	defer cache.mu.Unlock()

	cache.keys = make(map[string]*ecdsa.PublicKey)
	cache.fetchedAt = time.Now()

	for _, k := range jwks.Keys {
		if k.Kty != "EC" {
			continue
		}
		xBytes, err := base64.RawURLEncoding.DecodeString(k.X)
		if err != nil {
			continue
		}
		yBytes, err := base64.RawURLEncoding.DecodeString(k.Y)
		if err != nil {
			continue
		}
		pub := &ecdsa.PublicKey{
			Curve: ellipticCurveForCrv(k.Crv),
			X:     new(big.Int).SetBytes(xBytes),
			Y:     new(big.Int).SetBytes(yBytes),
		}
		cache.keys[k.Kid] = pub
	}

	if key, ok := cache.keys[kid]; ok {
		return key, nil
	}
	return nil, fmt.Errorf("key ID %q not found in JWKS", kid)
}

func ellipticCurveForCrv(crv string) elliptic.Curve {
	switch crv {
	case "P-256":
		return elliptic.P256()
	case "P-384":
		return elliptic.P384()
	default:
		return elliptic.P256()
	}
}

// --- Middleware ---

func AuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	supabaseURL := os.Getenv("SUPABASE_URL") // e.g. https://qmdfqlvsrpebevswmugt.supabase.co
	jwksURL := supabaseURL + "/auth/v1/.well-known/jwks.json"

	return func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing authorization header"})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid authorization format"})
		}

		tokenStr := parts[1]

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			switch t.Method.(type) {

			case *jwt.SigningMethodECDSA:
				kid, ok := t.Header["kid"].(string)
				if !ok {
					fmt.Println("❌ missing kid in header")
					return nil, fmt.Errorf("missing kid in token header")
				}
				fmt.Printf("✅ kid found: %s\n", kid)
				fmt.Printf("🔍 fetching JWKS from: %s\n", jwksURL)

				key, err := getPublicKey(kid, jwksURL)
				if err != nil {
					fmt.Printf("❌ getPublicKey error: %v\n", err)
					return nil, err
				}
				fmt.Printf("✅ public key fetched successfully\n")
				return key, nil

			case *jwt.SigningMethodHMAC:
				secret := os.Getenv("SUPABASE_JWT_SECRET")
				return []byte(secret), nil

			default:
				fmt.Printf("❌ unsupported alg: %v\n", t.Header["alg"])
				return nil, fmt.Errorf("unsupported signing method: %v", t.Header["alg"])
			}
		})

		fmt.Printf("parse result → err: %v | valid: %v\n", err, token != nil && token.Valid)

		if err != nil || !token.Valid {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token claims"})
		}

		userID, ok := claims["sub"].(string)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid user ID in token"})
		}

		email, _ := claims["email"].(string)
		role, _ := claims["role"].(string)
		if role == "" {
			role = "authenticated"
		}

		c.Set("user", &AuthenticatedUser{  // ✅ store as pointer
		    UserID: userID,
		    Email:  email,
		    Role:   role,
		})
		c.Set("userID", userID)

		return next(c)
	}
}
