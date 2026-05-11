package invitations

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type InvitationHandler struct {
	invitationService *services.InvitationService
}

func NewInvitationHandler(invitationService *services.InvitationService) *InvitationHandler {
	return &InvitationHandler{
		invitationService: invitationService,
	}
}

func (h *InvitationHandler) Create(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.CreateInvitationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	inv, err := h.invitationService.CreateInvitation(userID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, inv)
}

func (h *InvitationHandler) Respond(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.RespondInvitationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	err := h.invitationService.RespondToInvitation(userID, req.InvitationID, req.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "responded successfully"})
}

func (h *InvitationHandler) GetInvitations(c echo.Context) error {
	userID := c.Get("userID").(string)

	invs, err := h.invitationService.GetInvitations(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, invs)
}
