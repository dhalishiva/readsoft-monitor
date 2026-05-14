const REGISTRY_URL = import.meta.env.VITE_REGISTRY_URL;
const REGISTRY_ANON_KEY = import.meta.env.VITE_REGISTRY_ANON_KEY;

async function callRegistry(functionName, body) {
  if (!REGISTRY_URL || !REGISTRY_ANON_KEY) {
    throw new Error('Registry not configured. Check VITE_REGISTRY_URL and VITE_REGISTRY_ANON_KEY in .env.local');
  }

  let res;
  try {
    res = await fetch(`${REGISTRY_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': REGISTRY_ANON_KEY,
        'Authorization': `Bearer ${REGISTRY_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Network error calling registry: ${err.message}`);
  }

  // Read body as text first so we can handle empty responses
  const text = await res.text();

  if (!text || text.trim() === '') {
    throw new Error(`Registry returned empty response (status ${res.status})`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Registry returned invalid JSON: ${text.slice(0, 100)}`);
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Registry error: ${res.status}`);
  }

  return data;
}

export async function lookupTenant(company_code) {
  return callRegistry('lookup-tenant', { company_code });
}

export async function validateLicense(
  license_key, supabase_url, supabase_anon_key,
  company_name, contact_email, company_code
) {
  return callRegistry('validate-license', {
    license_key, supabase_url, supabase_anon_key,
    company_name, contact_email, company_code,
  });
}

export async function submitTicket(
  company_code, submitted_by_email, submitted_by_name,
  subject, description, priority, category
) {
  return callRegistry('submit-ticket', {
    company_code, submitted_by_email, submitted_by_name,
    subject, description, priority, category,
  });
}