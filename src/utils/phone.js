export const callingCodes = [
  ["RO", "Romania", "+40"], ["US", "United States", "+1"], ["CA", "Canada", "+1"],
  ["GB", "United Kingdom", "+44"], ["IE", "Ireland", "+353"], ["DE", "Germany", "+49"],
  ["FR", "France", "+33"], ["IT", "Italy", "+39"], ["ES", "Spain", "+34"],
  ["PT", "Portugal", "+351"], ["NL", "Netherlands", "+31"], ["BE", "Belgium", "+32"],
  ["AT", "Austria", "+43"], ["CH", "Switzerland", "+41"], ["PL", "Poland", "+48"],
  ["HU", "Hungary", "+36"], ["BG", "Bulgaria", "+359"], ["GR", "Greece", "+30"],
  ["MD", "Moldova", "+373"], ["TR", "Türkiye", "+90"], ["UA", "Ukraine", "+380"],
  ["IN", "India", "+91"], ["AU", "Australia", "+61"], ["NZ", "New Zealand", "+64"],
];

export function toE164Phone(localNumber, countryCode) {
  const digits = String(localNumber || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";

  const phone = `${countryCode}${digits}`;
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new Error("Enter a valid phone number, or leave it blank.");
  }
  return phone;
}

export function splitE164Phone(phone, fallbackCountryCode = "+40") {
  const value = String(phone || "").trim();
  if (!value) return { countryCode: fallbackCountryCode, localNumber: "" };

  const digits = value.replace(/\D/g, "");
  const international = value.startsWith("+") || value.startsWith("00");
  if (!international) return { countryCode: fallbackCountryCode, localNumber: value };

  const normalizedDigits = value.startsWith("00") ? digits.slice(2) : digits;
  const matchingCodes = [...new Set(callingCodes.map(([, , code]) => code))]
    .sort((left, right) => right.length - left.length);
  const matchedCode = matchingCodes.find((code) => normalizedDigits.startsWith(code.slice(1)));
  if (!matchedCode) return { countryCode: fallbackCountryCode, localNumber: normalizedDigits };

  return {
    countryCode: matchedCode,
    localNumber: normalizedDigits.slice(matchedCode.length - 1),
  };
}
