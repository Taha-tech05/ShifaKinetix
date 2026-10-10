// Ported from _web_reference/meshNameUtils.js (pure string logic, no DOM). Behaviour unchanged.

function stripExportSuffixes(name: string): string {
  let n = name;
  n = n.replace(/_?Generated_Mesh_From_X3D\d+/gi, '');
  n = n.replace(/_(Cube|Cone|Plane|Cylinder|BezierCurve|Sphere|Circle)\d+/gi, '');
  n = n.replace(/_[12]$/, '');
  n = n.replace(/_?0*\d{2,3}$/, '');
  return n;
}

function extractSide(name: string): { base: string; side: 'Left' | 'Right' | null } {
  let m = name.match(/^(.*)_([lr])$/i);
  if (m) return { base: m[1], side: m[2].toLowerCase() === 'l' ? 'Left' : 'Right' };
  m = name.match(/^(.*[a-z])([lr])$/);
  if (m && m[1].length >= 3) return { base: m[1], side: m[2] === 'l' ? 'Left' : 'Right' };
  return { base: name, side: null };
}

function toTitleCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatMeshLabel(rawName: string): string {
  if (!rawName) return '';
  const { base, side } = extractSide(stripExportSuffixes(rawName));
  const displayName = toTitleCase(base);
  return side ? `${displayName} (${side})` : displayName;
}
