// safely read a fetch response: json when possible, otherwise a short error blob

export async function readJson(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  const text = await res.text().catch(() => "");
  return { error: text.slice(0, 300) || `${res.status} ${res.statusText}` };
}
