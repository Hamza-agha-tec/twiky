package utils

import (
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type LinkEmbed struct {
	URL         string `json:"url"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	ImageURL    string `json:"image_url,omitempty"`
	SiteName    string `json:"site_name,omitempty"`
	Favicon     string `json:"favicon,omitempty"`
}

var urlRegex = regexp.MustCompile(`https?://[^\s/$.?#].[^\s]*`)

// ExtractURLs finds all URLs in a string
func ExtractURLs(content string) []string {
	matches := urlRegex.FindAllString(content, -1)
	if len(matches) == 0 {
		return nil
	}
	// Deduplicate
	seen := make(map[string]bool)
	var uniq []string
	for _, m := range matches {
		if !seen[m] {
			seen[m] = true
			uniq = append(uniq, m)
		}
	}
	return uniq
}

// UnfurlURL fetches OpenGraph and standard meta tags for a URL
func UnfurlURL(targetURL string) *LinkEmbed {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 TwikyUnfurler/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	// Read first 256KB to avoid loading giant assets/media files into memory
	lr := &io.LimitedReader{R: resp.Body, N: 256 * 1024}
	bodyBytes, err := io.ReadAll(lr)
	if err != nil {
		return nil
	}
	html := string(bodyBytes)

	embed := &LinkEmbed{
		URL: targetURL,
	}

	// Regexes to extract OpenGraph or regular tags
	titleReg := regexp.MustCompile(`(?i)<meta\s+property=["']og:title["']\s+content=["'](.*?)["']`)
	titleReg2 := regexp.MustCompile(`(?i)<meta\s+content=["'](.*?)["']\s+property=["']og:title["']`)
	descReg := regexp.MustCompile(`(?i)<meta\s+property=["']og:description["']\s+content=["'](.*?)["']`)
	descReg2 := regexp.MustCompile(`(?i)<meta\s+content=["'](.*?)["']\s+property=["']og:description["']`)
	imageReg := regexp.MustCompile(`(?i)<meta\s+property=["']og:image["']\s+content=["'](.*?)["']`)
	imageReg2 := regexp.MustCompile(`(?i)<meta\s+content=["'](.*?)["']\s+property=["']og:image["']`)
	siteReg := regexp.MustCompile(`(?i)<meta\s+property=["']og:site_name["']\s+content=["'](.*?)["']`)
	siteReg2 := regexp.MustCompile(`(?i)<meta\s+content=["'](.*?)["']\s+property=["']og:site_name["']`)

	// Standard meta fallbacks
	stdTitleReg := regexp.MustCompile(`(?i)<title>(.*?)</title>`)
	stdDescReg := regexp.MustCompile(`(?i)<meta\s+name=["']description["']\s+content=["'](.*?)["']`)
	stdDescReg2 := regexp.MustCompile(`(?i)<meta\s+content=["'](.*?)["']\s+name=["']description["']`)
	
	// Title
	if matches := titleReg.FindStringSubmatch(html); len(matches) > 1 {
		embed.Title = matches[1]
	} else if matches := titleReg2.FindStringSubmatch(html); len(matches) > 1 {
		embed.Title = matches[1]
	} else if matches := stdTitleReg.FindStringSubmatch(html); len(matches) > 1 {
		embed.Title = matches[1]
	}

	// Description
	if matches := descReg.FindStringSubmatch(html); len(matches) > 1 {
		embed.Description = matches[1]
	} else if matches := descReg2.FindStringSubmatch(html); len(matches) > 1 {
		embed.Description = matches[1]
	} else if matches := stdDescReg.FindStringSubmatch(html); len(matches) > 1 {
		embed.Description = matches[1]
	} else if matches := stdDescReg2.FindStringSubmatch(html); len(matches) > 1 {
		embed.Description = matches[1]
	}

	// Image
	if matches := imageReg.FindStringSubmatch(html); len(matches) > 1 {
		embed.ImageURL = matches[1]
	} else if matches := imageReg2.FindStringSubmatch(html); len(matches) > 1 {
		embed.ImageURL = matches[1]
	}

	// Site Name
	if matches := siteReg.FindStringSubmatch(html); len(matches) > 1 {
		embed.SiteName = matches[1]
	} else if matches := siteReg2.FindStringSubmatch(html); len(matches) > 1 {
		embed.SiteName = matches[1]
	}

	// Derive site name if empty
	if embed.SiteName == "" {
		if parts := strings.Split(targetURL, "/"); len(parts) > 2 {
			embed.SiteName = parts[2]
		}
	}

	// Derive favicon
	favReg := regexp.MustCompile(`(?i)<link\s+[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*href=["'](.*?)["']`)
	if matches := favReg.FindStringSubmatch(html); len(matches) > 1 {
		favHref := matches[1]
		if strings.HasPrefix(favHref, "http") {
			embed.Favicon = favHref
		} else if strings.HasPrefix(favHref, "//") {
			embed.Favicon = "https:" + favHref
		} else {
			// Relative path
			base := ""
			if parts := strings.Split(targetURL, "/"); len(parts) > 2 {
				base = parts[0] + "//" + parts[2]
			}
			if strings.HasPrefix(favHref, "/") {
				embed.Favicon = base + favHref
			} else {
				embed.Favicon = base + "/" + favHref
			}
		}
	}

	// Clean HTML entities if any
	embed.Title = cleanHTML(embed.Title)
	embed.Description = cleanHTML(embed.Description)

	if embed.Title == "" && embed.Description == "" {
		return nil
	}

	return embed
}

func cleanHTML(s string) string {
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", "\"")
	s = strings.ReplaceAll(s, "&#39;", "'")
	return strings.TrimSpace(s)
}
