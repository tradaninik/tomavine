const GRAPH_VERSION = "v22.0";

export async function waText(to: string, text: string): Promise<string | null> {
  const phoneId = process.env.WA_PHONE_NUMBER_ID ?? "";
  const token = process.env.WA_TOKEN ?? "";

  if (phoneId === "" || token === "") {
    console.log(`[WA:skipped] to=${to} :: ${text}`);
    return null;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/[^0-9]/g, ""),
        type: "text",
        text: {
          preview_url: false,
          body: text,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[WA:error] send failed (${res.status}): ${detail}`);
      return null;
    }

    const data = (await res.json()) as { messages?: { id: string }[] };

    return data.messages?.[0]?.id ?? null;
  } catch (e) {
    console.error("[WA:error] send failed:", e);
    return null;
  }
}

export async function waMarkRead(messageId: string): Promise<void> {
  const phoneId = process.env.WA_PHONE_NUMBER_ID ?? "";
  const token = process.env.WA_TOKEN ?? "";

  if (phoneId === "" || token === "") {
    console.log(`[WA:skipped] read=${messageId}`);
    return;
  }

  try {
    await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch (e) {
    console.error("[WA:error] mark-read failed:", e);
  }
}