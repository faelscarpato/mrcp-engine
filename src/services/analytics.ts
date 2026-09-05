export function trackEngineUsage(
  userId: string | null,
  eventName: string,
  additionalParams: Record<string, any> = {},
) {
  const measurementId = process.env.GA_MEASUREMENT_ID || "G-HSQM4Q77P6";
  const apiSecret = process.env.GA_API_SECRET;

  if (!apiSecret) {
    return;
  }

  const clientId =
    userId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : (Math.random() + 1).toString(36).substring(7));

  fetch(
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
            params: additionalParams,
          },
        ],
      }),
    },
  )
    .then(async (res) => {
      if (!res.ok) {
        console.warn("Falha ao enviar evento pro GA4:", await res.text());
      }
    })
    .catch((err) => {
      console.warn(
        "Erro silencioso ao disparar Measurement Protocol GA4:",
        err,
      );
    });
}
