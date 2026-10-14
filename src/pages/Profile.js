import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const emptyState = {
  name: "",
  email: "",
  phone: "",
};

export default function Profile() {
  const { user, updateProfile, refreshProfile } = useAuth();
  const [form, setForm] = useState(emptyState);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("success");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!user?.sub) return undefined;

    let cancelled = false;
    setLoadingProfile(true);
    refreshProfile()
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

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile() {
    setStatus("");
    setStatusType("success");
    setSaving(true);

    try {
      await updateProfile({
        name: form.name,
        phone: form.phone,
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

            <label>
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={form.email}
                readOnly
              />
            </label>
            <p className="auth-subtitle">This is your verified sign-in email.</p>

            <label>
              <span>Phone</span>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />
            </label>

            {status && <p className={statusType === "error" ? "error-box" : "success-text"} role="status">{status}</p>}

            <button type="button" className="submit-button" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        <div className="info-panel">
          <h3>Account summary</h3>
          <ul className="settings-list">
            <li>Name: {user?.name || "Not set"}</li>
            <li>Email: {user?.email || "Not set"}</li>
            <li>Phone: {user?.phone || "Not set"}</li>
            <li>Linked devices: {loadingProfile ? "Loading..." : (user?.devices?.length ?? 0)}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
