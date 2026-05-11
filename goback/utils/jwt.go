package utils

import (
	"encoding/base64"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// VerifySupabaseToken verifies a Supabase JWT token
func VerifySupabaseToken(tokenString, jwtSecret string) (*jwt.Token, error) {
	// Try different approaches to verify the token
	
	// First try with HMAC (for development tokens)
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); ok {
			return []byte(jwtSecret), nil
		}
		return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
	})
	
	if err == nil && token.Valid {
		return token, nil
	}
	
	// Try with ES256 using decoded secret
	token, err = jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodECDSA); ok {
			// Decode the base64 JWT secret
			decodedSecret, err := base64.StdEncoding.DecodeString(jwtSecret)
			if err != nil {
				// If decoding fails, try with raw secret
				return []byte(jwtSecret), nil
			}
			return decodedSecret, nil
		}
		return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
	})
	
	if err == nil && token.Valid {
		return token, nil
	}
	
	// Try with RS256 using decoded secret
	token, err = jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); ok {
			// Decode the base64 JWT secret
			decodedSecret, err := base64.StdEncoding.DecodeString(jwtSecret)
			if err != nil {
				// If decoding fails, try with raw secret
				return []byte(jwtSecret), nil
			}
			return decodedSecret, nil
		}
		return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
	})
	
	if err == nil && token.Valid {
		return token, nil
	}
	
	// If all attempts fail, return the last error
	return nil, err
}
