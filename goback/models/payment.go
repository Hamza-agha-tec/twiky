package models

import (
	"time"
)

type UserSubscription struct {
	ID                 string    `json:"id" db:"id"`
	UserID             string    `json:"user_id" db:"user_id"`
	DodoSubscriptionID string    `json:"dodo_subscription_id" db:"dodo_subscription_id"`
	DodoCustomerID     string    `json:"dodo_customer_id" db:"dodo_customer_id"`
	Status             string    `json:"status" db:"status"` // inactive, active
	CurrentPeriodEnd   time.Time `json:"current_period_end" db:"current_period_end"`
	PlanType           string    `json:"plan_type" db:"plan_type"` // FREE, PRO, GEEK
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

type Order struct {
	ID                    string    `json:"id" db:"id"`
	UserID                string    `json:"user_id" db:"user_id"`
	CustomerEmail         string    `json:"customer_email" db:"customer_email"`
	AmountTotal           float64   `json:"amount_total" db:"amount_total"`
	PaymentID             string    `json:"payment_id" db:"payment_id"`
	Status                string    `json:"status" db:"status"` // pending, completed, failed
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time `json:"updated_at" db:"updated_at"`
	DodoOrderID           string    `json:"dodo_order_id" db:"dodo_order_id"`
	Currency              string    `json:"currency" db:"currency"`
	DodoInvoiceID         string    `json:"dodo_invoice_id" db:"dodo_invoice_id"`
	DodoBusinessID        string    `json:"dodo_business_id" db:"dodo_business_id"`
	DodoBrandID           string    `json:"dodo_brand_id" db:"dodo_brand_id"`
	DodoCheckoutSessionID string    `json:"dodo_checkout_session_id" db:"dodo_checkout_session_id"`
	DodoPaymentLink       string    `json:"dodo_payment_link" db:"dodo_payment_link"`
	ProductID             string    `json:"product_id" db:"product_id"`
}

type Product struct {
	ID            string                   `json:"id" db:"id"`
	CreatedAt     time.Time                `json:"created_at" db:"created_at"`
	UpdatedAt     *time.Time               `json:"updated_at,omitempty" db:"updated_at"`
	Title         string                   `json:"title" db:"title"`
	Description   string                   `json:"description" db:"description"`
	Price         float64                  `json:"price" db:"price"`
	Currency      string                   `json:"currency,omitempty"`
	Category      string                   `json:"category" db:"category"`
	Features      []string                 `json:"features" db:"features"`
	Slug          string                   `json:"slug" db:"slug"`
	Active        bool                     `json:"active" db:"active"`
	Sales         int64                    `json:"sales" db:"sales"`
	DodoProductID string                   `json:"dodo_product_id" db:"dodo_product_id"`
	Discount      *int64                   `json:"discount" db:"discount"`
	Images        []string                 `json:"images" db:"images"`
}
