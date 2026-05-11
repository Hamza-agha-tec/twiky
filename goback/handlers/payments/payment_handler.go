package payments

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type PaymentHandler struct {
	paymentService         *services.PaymentService
	productPaymentsService *services.ProductPaymentsService
}

func NewPaymentHandler(paymentService *services.PaymentService, productPaymentsService *services.ProductPaymentsService) *PaymentHandler {
	return &PaymentHandler{
		paymentService:         paymentService,
		productPaymentsService: productPaymentsService,
	}
}

func (h *PaymentHandler) CreateCheckout(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	var dto models.CreateCheckoutDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	session, err := h.paymentService.CreateCheckoutSession(user.UserID, dto.ProductID, dto.RedirectURL)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create checkout session"})
	}

	return c.JSON(http.StatusOK, session)
}

func (h *PaymentHandler) GetSubscription(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	subscription, err := h.paymentService.GetSubscription(user.UserID)
	if err != nil {
		if err.Error() == "no active subscription found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "no active subscription found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get subscription"})
	}

	return c.JSON(http.StatusOK, subscription)
}

func (h *PaymentHandler) GetPortal(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	portalURL, err := h.paymentService.GetCustomerPortalUrl(user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get portal URL"})
	}

	return c.JSON(http.StatusOK, map[string]string{"portal_url": portalURL})
}

func (h *PaymentHandler) CreateProductCheckout(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	var dto models.ProductCheckoutDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	session, err := h.productPaymentsService.CreateProductCheckout(user.UserID, dto)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create product checkout"})
	}

	return c.JSON(http.StatusOK, session)
}

func (h *PaymentHandler) GetOrders(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	orders, err := h.productPaymentsService.GetOrders(user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get orders"})
	}

	return c.JSON(http.StatusOK, orders)
}

func (h *PaymentHandler) GetOrderById(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	orderID := c.Param("orderId")

	order, err := h.productPaymentsService.GetOrderByID(user.UserID, orderID)
	if err != nil {
		if err.Error() == "order not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "order not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get order"})
	}

	return c.JSON(http.StatusOK, order)
}

func (h *PaymentHandler) HandleWebhook(c echo.Context) error {
	// Get raw body
	bodyBytes := make([]byte, c.Request().ContentLength)
	_, err := c.Request().Body.Read(bodyBytes)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "failed to read request body"})
	}
	rawPayload := string(bodyBytes)

	// Get headers
	headers := make(map[string][]string)
	for key, values := range c.Request().Header {
		headers[key] = values
	}

	err = h.paymentService.HandleWebhook(rawPayload, headers)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to handle webhook"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "webhook processed successfully"})
}
