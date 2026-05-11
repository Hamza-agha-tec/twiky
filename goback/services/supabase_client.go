package services

import (
	"github.com/nedpals/supabase-go"
)

type SupabaseClient struct {
	client *supabase.Client
}

func NewSupabaseClient(supabaseURL, supabaseKey string) *SupabaseClient {
	client := supabase.CreateClient(supabaseURL, supabaseKey)
	return &SupabaseClient{
		client: client,
	}
}

func (s *SupabaseClient) GetClient() *supabase.Client {
	return s.client
}
