package services

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/lib/pq"
)

func sqlNullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func sqlNullUUID(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func defaultString(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

func tagsArray(tags []string) interface{} {
	if tags == nil {
		return pq.Array([]string{})
	}
	return pq.Array(tags)
}

func attachmentsJSON(attachments []map[string]interface{}) ([]byte, error) {
	if attachments == nil {
		return []byte("[]"), nil
	}
	return json.Marshal(attachments)
}

func nullStringPtr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	s := ns.String
	return &s
}

func nullTimePtr(nt sql.NullTime) *time.Time {
	if !nt.Valid {
		return nil
	}
	t := nt.Time
	return &t
}
