const express = require("express");

const router = express.Router();

const VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN || "my_verify_token";

/* =========================
   WEBHOOK VERIFICATION
========================= */

router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === VERIFY_TOKEN
  ) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

/* =========================
   WEBHOOK EVENTS
========================= */

router.post("/", (req, res) => {
  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value || {};

        /* =========================
           MESSAGE STATUS
        ========================= */

        const statuses = value.statuses || [];

        for (const status of statuses) {
          console.log(
            "WhatsApp status:",
            status.status,
            status.id
          );

          if (status.status === "failed") {
            console.error(
              "WhatsApp message failed:",
              status.errors
            );
          }
        }

        /* =========================
           INCOMING MESSAGES
        ========================= */

        const messages = value.messages || [];

        for (const message of messages) {
          console.log(
            "WhatsApp message:",
            message.id,
            message.from,
            message.type
          );

          if (message.text) {
            console.log(
              "Message:",
              message.text.body
            );
          }
        }
      }
    }

    // Respond quickly to WhatsApp
    return res.sendStatus(200);

  } catch (error) {
    console.error(
      "WhatsApp webhook error:",
      error
    );

    return res.sendStatus(500);
  }
});

module.exports = router;


