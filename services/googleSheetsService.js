export async function appendRowsToGoogleSheet({ accessToken, spreadsheetId, range, rows }) {
  if (!accessToken) throw new Error('A Google OAuth access token is required.');
  if (!spreadsheetId) throw new Error('A Google Sheets spreadsheet ID is required.');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Provide at least one row to export.');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range || 'Sheet1!A1')}:append?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: rows, majorDimension: 'ROWS' }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Sheets rejected the export (${response.status}): ${details}`);
  }
  return response.json();
}
