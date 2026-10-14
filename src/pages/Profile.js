import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const emptyState = {
  name: "",
  email: "",
  phone: "",
};

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState(emptyState);
  const [status, setStatus] = useState("");

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

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");

    try {
      await updateProfile(form);
      setStatus("Your profile was updated successfully.");
    } catch (error) {
      setStatus(error.message || "Unable to update the profile.");
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
          <form className="profile-form" onSubmit={handleSubmit}>
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

            {status && <p className="success-text">{status}</p>}

            <button type="submit" className="submit-button">Save changes</button>
          </form>
        </div>

        <div className="info-panel">
          <h3>Account summary</h3>
          <ul className="settings-list">
            <li>Name: {user?.name || "Not set"}</li>
            <li>Email: {user?.email || "Not set"}</li>
            <li>Phone: {user?.phone || "Not set"}</li>
            <li>Linked devices: {user?.devices?.length || 0}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
