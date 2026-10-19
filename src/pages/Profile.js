import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { callingCodes, splitE164Phone, toE164Phone } from "../utils/phone";
import useDeviceCount from "../hooks/useDeviceCount";
import useUnreadNotifications from "../hooks/useUnreadNotifications";

const emptyState = {
  name: "",
  email: "",
  phone: "",
};

export default function Profile() {
  const deviceCount = useDeviceCount();
  const { unreadCount } = useUnreadNotifications();
  const { user, updateProfile, refreshProfile } = useAuth();
  const [form, setForm] = useState(emptyState);
  const [phoneCountryCode, setPhoneCountryCode] = useState("+40");
  const [databaseProfile, setDatabaseProfile] = useState(null);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("success");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!user?.sub) return undefined;

    let cancelled = false;
    setLoadingProfile(true);
    refreshProfile()
      .then((profile) => {
        if (!cancelled) {
          const phoneParts = splitE164Phone(profile.phone);
          setDatabaseProfile(profile);
          setPhoneCountryCode(phoneParts.countryCode);
          setForm({
            name: profile.name || "",
            email: profile.email || "",
            phone: phoneParts.localNumber,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusType("error");
          setStatus(error.message || "Unable to load profile from the database.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => { cancelled = true; };
  }, [user?.sub, refreshProfile]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile() {
    setStatus("");
    setStatusType("success");
    setSaving(true);

    try {
      const phone = toE164Phone(form.phone, phoneCountryCode);
      const updatedProfile = await updateProfile({
        name: form.name,
        phone,
      });
      const phoneParts = splitE164Phone(updatedProfile.phone);
      setDatabaseProfile(updatedProfile);
      setPhoneCountryCode(phoneParts.countryCode);
      setForm({
        name: updatedProfile.name || "",
        email: updatedProfile.email || user?.email || "",
        phone: phoneParts.localNumber,
      });
      setStatus("Your profile was updated successfully.");
    } catch (error) {
      setStatusType("error");
      setStatus(error.message || "Unable to update the profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Profile</h1>
        </div>
      </div>

      <div className="panel-grid profile-layout">
        <div className="info-panel">
          <h3>Personal details</h3>
          <div className="profile-form">
            <label>
              <span>Name</span>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
              />
            </label>

            <label className="readonly-field">
              <span>Email <span className="readonly-label">Verified · cannot be changed here</span></span>
              <input
                type="email"
                name="email"
                value={form.email}
                readOnly
                aria-readonly="true"
                aria-describedby="email-readonly-help"
              />
            </label>
            <p id="email-readonly-help" className="field-help">This is your verified sign-in email.</p>

            <div className="phone-field">
              <label htmlFor="profile-phone" className="field-label">Phone <span className="optional-label">(optional)</span></label>
              <div className="phone-input-row">
                <select
                  aria-label="Phone country calling code"
                  value={phoneCountryCode}
                  onChange={(event) => setPhoneCountryCode(event.target.value)}
                >
                  {callingCodes.map(([country, countryName, code]) => (
                    <option key={`${country}-${code}`} value={code}>{country} {code} · {countryName}</option>
                  ))}
                </select>
                <input
                  id="profile-phone"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                  autoComplete="tel-national"
                  inputMode="tel"
                />
              </div>
              <span className="phone-help">Choose your country code and enter your number without the country prefix.</span>
            </div>

            {status && <p className={statusType === "error" ? "error-box" : "success-text"} role="status">{status}</p>}

            <button type="button" className="submit-button" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        <div className="info-panel">
          <h3>Account summary</h3>
          <ul className="settings-list">
            <li>Name: {loadingProfile ? "Loading..." : (databaseProfile?.name || "Not set")}</li>
            <li>Email: {user?.email || "Not set"}</li>
            <li>Phone: {loadingProfile ? "Loading..." : (databaseProfile?.phone || "Not set")}</li>
            <li>Linked devices: {deviceCount}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
