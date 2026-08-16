export function parseUserAgent(ua = "") {
  const s = String(ua || "");
  let device = "desktop";
  if (/ipad|tablet|playbook|silk/i.test(s)) device = "tablet";
  else if (/mobi|iphone|android|webos|blackberry|opera mini/i.test(s)) {
    device = "mobile";
  }

  let browser = "other";
  if (/edg\//i.test(s)) browser = "edge";
  else if (/opr\/|opera/i.test(s)) browser = "opera";
  else if (/chrome|crios/i.test(s)) browser = "chrome";
  else if (/firefox|fxios/i.test(s)) browser = "firefox";
  else if (/safari/i.test(s)) browser = "safari";
  else if (/msie|trident/i.test(s)) browser = "ie";

  return { device, browser };
}
