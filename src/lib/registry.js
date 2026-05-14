// Calls the FlowSentinel central registry Edge Functions.
// The registry URL never changes — it's always YOUR Supabase project.

const REGISTRY_URL = import.meta.env.VITE_REGISTRY_URL;
const REGISTRY_ANON_KEY = import.meta.env.VITE_REGISTRY_ANON_KEY;

async function callRegistry(functionName, body) {
  const res = await fetch(`${REGISTRY_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': REGISTRY_ANON_KEY,
      'Authorization': `Bearer ${REGISTRY_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Registry call failed: ${res.status}`);
  }
  return data;
}

// Look up a tenant by company code.
// Returns: { company_name, supabase_url, supabase_anon_key, license }
export async function lookupTenant(company_code) {
  return callRegistry('lookup-tenant', { company_code });
}

// Validate a license key and register a new tenant.
// Returns: { company_code, company_name, license_type, max_mailboxes, expires_at }
export async function validateLicense(license_key, supabase_url, supabase_anon_key, company_name, contact_email, company_code) {
  return callRegistry('validate-license', {
    license_key,
    supabase_url,
    supabase_anon_key,
    company_name,
    contact_email,
    company_code,
  });
}

// Submit a support ticket from inside the app.
export async function submitTicket(company_code, submitted_by_email, submitted_by_name, subject, description, priority, category) {
  return callRegistry('submit-ticket', {
    company_code,
    submitted_by_email,
    submitted_by_name,
    subject,
    description,
    priority,
    category,
  });
}