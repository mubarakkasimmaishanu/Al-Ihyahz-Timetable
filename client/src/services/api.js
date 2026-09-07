const API_BASE = '/api';

export async function fetchTeachers() {
  const res = await fetch(`${API_BASE}/teachers`);
  if (!res.ok) throw new Error('Failed to fetch teachers');
  return res.json();
}

export async function saveTeacher(data, id = null) {
  const url = id ? `${API_BASE}/teachers/${id}` : `${API_BASE}/teachers`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save teacher');
  return res.json();
}

export async function deleteTeacher(id) {
  const res = await fetch(`${API_BASE}/teachers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete teacher');
  return res.json();
}

export async function fetchClasses() {
  const res = await fetch(`${API_BASE}/classes`);
  if (!res.ok) throw new Error('Failed to fetch classes');
  return res.json();
}

export async function saveClass(data, id = null) {
  const url = id ? `${API_BASE}/classes/${id}` : `${API_BASE}/classes`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save class');
  return res.json();
}

export async function deleteClass(id) {
  const res = await fetch(`${API_BASE}/classes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete class');
  return res.json();
}

export async function fetchSubjects() {
  const res = await fetch(`${API_BASE}/subjects`);
  if (!res.ok) throw new Error('Failed to fetch subjects');
  return res.json();
}

export async function saveSubject(data, id = null) {
  const url = id ? `${API_BASE}/subjects/${id}` : `${API_BASE}/subjects`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save subject');
  return res.json();
}

export async function deleteSubject(id) {
  const res = await fetch(`${API_BASE}/subjects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete subject');
  return res.json();
}

export async function fetchAllocations(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const res = await fetch(`${API_BASE}/allocations?${params}`);
  if (!res.ok) throw new Error('Failed to fetch allocations');
  return res.json();
}

export async function saveAllocation(data, id = null) {
  const url = id ? `${API_BASE}/allocations/${id}` : `${API_BASE}/allocations`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save allocation');
  return res.json();
}

export async function deleteAllocation(id) {
  const res = await fetch(`${API_BASE}/allocations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete allocation');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function saveSettings(data) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
}

export async function fetchTimetable() {
  const res = await fetch(`${API_BASE}/timetable`);
  if (!res.ok) throw new Error('Failed to fetch timetable');
  return res.json();
}

export async function generateTimetable() {
  const res = await fetch(`${API_BASE}/timetable/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Generation failed');
  }
  return data;
}

export async function validateTimetableApi() {
  const res = await fetch(`${API_BASE}/timetable/validate`);
  if (!res.ok) throw new Error('Failed to validate timetable');
  return res.json();
}

export async function resetToDemoData() {
  const res = await fetch(`${API_BASE}/timetable/reset-demo`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset demo data');
  return res.json();
}

export async function clearTimetableSlots() {
  const res = await fetch(`${API_BASE}/timetable/clear`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to clear timetable slots');
  return res.json();
}
