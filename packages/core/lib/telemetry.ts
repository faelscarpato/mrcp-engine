export async function trackEvent(
  eventName: string,
  params: Record<string, any> = {},
) {
  const measurementId = process.env.GA_MEASUREMENT_ID || "G-HSQM4Q77P6";
  const apiSecret = process.env.GA_API_SECRET;

  if (!apiSecret) {
    return;
  }

  // Gera client_id usando Web Crypto API (nativo no Node.js 16+ e Edge)
  const clientId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : (Math.random() + 1).toString(36).substring(7);

  try {
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          events: [
            {
              name: eventName,
              params: params,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      console.warn("Falha ao enviar evento pro GA4:", await response.text());
    }
  } catch (error) {
    console.warn("Erro ao disparar Measurement Protocol GA4:", error);
  }
}
