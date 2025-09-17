const BASE = 'https://apiconnect.angelbroking.com'; // change if needed

export async function login({ tradingKey, clientCode, mpin, totp }) {
  const r = await fetch(BASE + '/rest/auth/angelbroking/user/v1/loginByPassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientcode: clientCode, password: mpin, totp, apikey: tradingKey })
  });
  return await r.json();
}

export async function placeOrder({ token, orderPayload }) {
  const r = await fetch(BASE + '/rest/secure/angelbroking/order/v1/placeOrder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(orderPayload)
  });
  return await r.json();
}

export async function createGTT({ token, gttPayload }) {
  const r = await fetch(BASE + '/rest/secure/angelbroking/gtt/v1/createRule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(gttPayload)
  });
  return await r.json();
}

export async function fetchScripByName({ marketKey, scrip }) {
  const r = await fetch(BASE + `/rest/secure/angelbroking/order/v1/searchScrip?scrip=${encodeURIComponent(scrip)}`, {
    headers: { Authorization: `Bearer ${marketKey}` }
  });
  return await r.json();
}
