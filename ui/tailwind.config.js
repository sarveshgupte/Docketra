export default {
content: [
"./index.html",
"./src/**/*.{js,ts,jsx,tsx}",
],
theme: {
extend: {
spacing: {
section: '4rem',
},
maxWidth: {
container: '72rem',
},
fontSize: {
pageTitle: '28px',
sectionTitle: '18px',
},
colors: {
primary: '#111111',
accent: '#3b82f6',
success: '#10b981',
warning: '#f59e0b',
error: '#ef4444',
border: '#e5e7eb',
textMain: '#111111',
textMuted: '#6b7280',
slate900: '#101010',
},
},
},
plugins: [],
}
