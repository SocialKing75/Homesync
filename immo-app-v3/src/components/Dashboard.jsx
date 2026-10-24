import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, computeScore } from '../context/AppContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  ScatterChart, Scatter, ComposedChart, ReferenceLine,
} from 'recharts';
import './Dashboard.css';

// ══════════════════════════════════════════════════════
// DONNÉES STATIQUES
// ══════════════════════════════════════════════════════

const QUARTIERS = [
  { nom: 'Mourillon',         moy: 4800, med: 4650, vol: 112, evol: 6.1,  score: 'hot' },
  { nom: 'Centre-Ville',      moy: 4120, med: 3980, vol: 98,  evol: 2.8,  score: 'ok'  },
  { nom: 'Saint-Jean du Var', moy: 3680, med: 3540, vol: 76,  evol: 3.4,  score: 'ok'  },
  { nom: 'La Rode',           moy: 3420, med: 3280, vol: 64,  evol: 1.9,  score: 'ok'  },
  { nom: 'Pont du Las',       moy: 3180, med: 3050, vol: 58,  evol: -1.2, score: 'cold'},
  { nom: 'Le Pradet',         moy: 3050, med: 2920, vol: 84,  evol: 4.6,  score: 'hot' },
  { nom: 'La Seyne',          moy: 2890, med: 2780, vol: 92,  evol: -0.8, score: 'cold'},
  { nom: 'Siblas',            moy: 2640, med: 2510, vol: 59,  evol: -3.2, score: 'cold'},
];

const PRIX_MENSUEL = [
  { mois: 'Jan 23', prix: 3280 }, { mois: 'Fév 23', prix: 3310 },
  { mois: 'Mar 23', prix: 3340 }, { mois: 'Avr 23', prix: 3360 },
  { mois: 'Mai 23', prix: 3390 }, { mois: 'Jun 23', prix: 3420 },
  { mois: 'Jul 23', prix: 3450 }, { mois: 'Aoû 23', prix: 3480 },
  { mois: 'Sep 23', prix: 3510 }, { mois: 'Oct 23', prix: 3490 },
  { mois: 'Nov 23', prix: 3520 }, { mois: 'Déc 23', prix: 3540 },
  { mois: 'Jan 24', prix: 3550 }, { mois: 'Fév 24', prix: 3580 },
  { mois: 'Mar 24', prix: 3600 }, { mois: 'Avr 24', prix: 3620 },
  { mois: 'Mai 24', prix: 3610 }, { mois: 'Jun 24', prix: 3640 },
  { mois: 'Jul 24', prix: 3660 }, { mois: 'Aoû 24', prix: 3680 },
  { mois: 'Sep 24', prix: 3700 }, { mois: 'Oct 24', prix: 3720 },
  { mois: 'Nov 24', prix: 3740 }, { mois: 'Déc 24', prix: 3760 },
];

const VOLUME_TRIM = [
  { trim: 'T1 23', vol: 58 }, { trim: 'T2 23', vol: 72 },
  { trim: 'T3 23', vol: 89 }, { trim: 'T4 23', vol: 64 },
  { trim: 'T1 24', vol: 61 }, { trim: 'T2 24', vol: 78 },
  { trim: 'T3 24', vol: 92 }, { trim: 'T4 24', vol: 68 },
];

const TYPE_DATA = [
  { name: 'Appartement', value: 463, pct: '72%', color: 'var(--orange)' },
  { name: 'Maison',      value: 180, pct: '28%', color: 'var(--gray-700)' },
];

// Génération des transactions DVF (déterministe)
function genDVF(n = 643) {
  const tx = [];
  for (let i = 0; i < n; i++) {
    const q    = QUARTIERS[i % QUARTIERS.length];
    const type = (i * 137 % 100) < 72 ? 'Appartement' : 'Maison';
    const surf = type === 'Maison' ? 80 + (i * 17 % 120) : 25 + (i * 13 % 85);
    const pm2  = Math.round(q.moy * (0.85 + (i * 7 % 30) / 100));
    const prix = surf * pm2;
    const ageMs   = (i * 86400000 * 2) % (730 * 86400000);
    const dateMs  = 1700000000000 - ageMs;
    const d       = new Date(dateMs);
    const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const pieces  = type === 'Maison' ? 3 + (i % 4) : 1 + (i % 4);
    const delta   = ((pm2 - q.moy) / q.moy * 100).toFixed(1);
    tx.push({ id: i+1, date: dateStr, dateMs, quartier: q.nom, type, surf, pieces, prix, pm2, delta });
  }
  return tx.sort((a, b) => b.dateMs - a.dateMs);
}
const DVF = genDVF();
const TYPE_DATA_VOL = (() => {
  const appt = DVF.filter(t => t.type === 'Appartement').reduce((s, t) => s + t.prix, 0);
  const mais = DVF.filter(t => t.type === 'Maison').reduce((s, t) => s + t.prix, 0);
  const tot  = appt + mais;
  return [
    { name: 'Appartement', value: appt, pct: `${Math.round(appt / tot * 100)}%`, color: 'var(--orange)' },
    { name: 'Maison',      value: mais, pct: `${Math.round(mais / tot * 100)}%`, color: 'var(--gray-700)' },
  ];
})();

function knnOpportunities() {
  const sample = DVF.slice(0, 200);
  const results = [];
  for (let i = 0; i < sample.length; i++) {
    const tx  = sample[i];
    const neighbors = sample
      .filter((_, j) => j !== i)
      .map(t => {
        const ds = (tx.surf - t.surf) / 175;
        const dp = (tx.pm2  - t.pm2)  / 4000;
        const dt = tx.type === t.type ? 0 : 0.5;
        return { ...t, dist: Math.sqrt(ds*ds + dp*dp + dt*dt) };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
    const avgPm2  = neighbors.reduce((s, n) => s + n.pm2, 0) / 5;
    const underval = (avgPm2 - tx.pm2) / avgPm2 * 100;
    if (underval > 12) results.push({ ...tx, neighbors, avgPm2, underval });
  }
  return results.sort((a, b) => b.underval - a.underval).slice(0, 12);
}
const OPPORTUNITIES = knnOpportunities();

const SCATTER_POINTS = DVF.slice(0, 200).map(t => ({ surface: t.surf, prix: t.prix }));
const REGR_LINE = Array.from({ length: 12 }, (_, i) => {
  const surface = 25 + i * 16;
  return { surface, prix: Math.round(24500 + surface * 3250) };
});

const RESIDUALS = DVF.slice(0, 100).map((t, i) => ({
  n: i,
  r: Math.round(t.pm2 - 3547 + (i * 11 % 800) - 400),
}));
const RESIDUALS_POS = RESIDUALS.filter(r => r.r >= 0);
const RESIDUALS_NEG = RESIDUALS.filter(r => r.r <  0);

const KPI_ETAT = [
  { label: 'Prix moyen / m²',    value: '3 547', unit: '€/m²',    sub: 'Toulon global',     delta: '+4.2%', up: true              },
  { label: 'Transactions / mois', value: '26.8',  unit: 'tx/mois', sub: 'moy. sur 24 mois',  delta: '+12',   up: true,  green: true },
  { label: 'Prix médian vente',   value: '178K€', unit: '',        sub: 'appartements',       delta: '−5%',   up: false             },
  { label: 'Délai moyen vente',   value: '68',    unit: 'jours',   sub: '',                   delta: '+11j',  up: false, red: true   },
  { label: 'Rendement locatif',   value: '4.8%',  unit: 'brut',    sub: 'estimé',             delta: '×3.2',  up: true,  green: true },
];
const KPI_TENDANCES = [
  { label: 'Indice tendance',         value: '+0.34',    sub: 'σ au-dessus médiane nationale', green: true },
  { label: 'Quartier le + actif',     value: 'Mourillon', sub: '4 800 €/m² — +6.1%',          green: true },
  { label: 'Segment porteur',         value: 'T2–T3',    sub: '45% des transactions'                      },
];

const QUARTIER_COEF = {
  'Centre-Ville':      31200,
  'Mourillon':         42800,
  'Siblas':           -18400,
  'Pont du Las':       -5000,
  'La Rode':           15000,
  'Saint-Jean du Var': 22000,
  'Le Pradet':         -8000,
  'La Seyne':         -22000,
};

function fmtPrix(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + ' M€';
  if (n >= 1000)    return Math.round(n / 1000) + ' K€';
  return n + ' €';
}

// Onglets selon le profil utilisateur
const TABS_AGENT = [
  { id: 'etat',         label: 'État du marché' },
  { id: 'tendances',    label: 'Tendances'       },
  { id: 'opportunites', label: 'Opportunités'    },
  { id: 'regression',   label: 'Régression'      },
];
const TABS_ACHETEUR = [
  { id: 'recherche',    label: 'Ma Recherche'   },
  { id: 'etat',         label: 'Marché'         },
  { id: 'opportunites', label: 'Opportunités'   },
];

export default function Dashboard({ forcedTab }) {
  const { theme, profil, annonces, user } = useApp();
  const navigate = useNavigate();

  const isAcheteur = user?.profil === 'Acheteur';
  const TABS = isAcheteur ? TABS_ACHETEUR : TABS_AGENT;

  const [activeTab,  setActiveTab]  = useState(isAcheteur ? 'recherche' : 'etat');
  const [filterQ,    setFilterQ]    = useState('');
  const [metricBar,  setMetricBar]  = useState('moy');   // 'moy' | 'med'
  const [metricPie,  setMetricPie]  = useState('tx');    // 'tx'  | 'vol'
  const [predSurf,   setPredSurf]   = useState(65);
  const [predQ,      setPredQ]      = useState('Centre-Ville');
  const [predType,   setPredType]   = useState(0);
  const [predEtage,  setPredEtage]  = useState(3);
  const [predResult, setPredResult] = useState(null);

  // Synchronize Tab Override from Parent (Accueil)
  useEffect(() => {
    if (forcedTab) {
       // Convert parent tabs to local dash-tabs
       if (forcedTab === 'analyses') setActiveTab('etat');
       if (forcedTab === 'opportunites') setActiveTab('opportunites');
    }
  }, [forcedTab]);

  // State pour les données de régression de l'API
  const [regressionData, setRegressionData] = useState(null);
  const [regressionLoading, setRegressionLoading] = useState(false);

  // State pour les opportunités k-NN
  const [opportunitesData, setOpportunitesData] = useState(null);
  const [opportunitesLoading, setOpportunitesLoading] = useState(false);

  // Charger les données k-NN
  useEffect(() => {
    if (activeTab === 'opportunites' && !opportunitesData) {
      setOpportunitesLoading(true);
      fetch('http://localhost:5001/api/knn_opportunities')
        .then(res => res.json())
        .then(data => {
          setOpportunitesData(data);
          setOpportunitesLoading(false);
        })
        .catch(() => {
          setOpportunitesLoading(false);
        });
    }
  }, [activeTab, opportunitesData]);

  // Charger les données de régression depuis l'API
  useEffect(() => {
    if (activeTab === 'regression' && !regressionData) {
      setRegressionLoading(true);
      fetch('http://localhost:5001/api/regression')
        .then(res => res.json())
        .then(data => {
          setRegressionData(data);
          setRegressionLoading(false);
        })
        .catch(() => {
          setRegressionLoading(false);
        });
    }
  }, [activeTab, regressionData]);

  // Couleurs selon le thème
  const gc   = theme === 'dark' ? '#374151' : '#e5e7eb';
  const tc   = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const tbg  = theme === 'dark' ? '#1f2937' : '#ffffff';
  const tbrd = theme === 'dark' ? '#374151' : '#e5e7eb';
  const ttxt = theme === 'dark' ? '#f9fafb' : '#111827';

  // ── Stats Acheteur ──
  const annoncesScored  = annonces.map(a => ({ ...a, score: computeScore(a, profil) }));
  const topAnnonces     = [...annoncesScored].sort((a, b) => b.score - a.score).slice(0, 3);
  const nbBudget        = annonces.filter(a => a.prix <= profil.prixMax).length;
  const nbTopMatch      = annoncesScored.filter(a => a.score >= 85).length;
  const avgScore        = Math.round(annoncesScored.reduce((s, a) => s + a.score, 0) / annoncesScored.length);
  const quartierBudget  = QUARTIERS.map(q => {
    const qAnn  = annonces.filter(a => a.quartier === q.nom);
    const avg   = qAnn.length
      ? Math.round(qAnn.reduce((s, a) => s + a.prix, 0) / qAnn.length)
      : Math.round(q.moy * 90);
    return { nom: q.nom, avgPrix: avg, accessible: avg <= profil.prixMax };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: tbg, border: `1px solid ${tbrd}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: ttxt }}>
        {label && <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>}
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.stroke }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('fr-FR') : p.value}
          </p>
        ))}
      </div>
    );
  };

  function doPrediction() {
    const base = 24500 + predSurf * 3250 + (QUARTIER_COEF[predQ] || 0) + Number(predType) + predEtage * 2100;
    setPredResult({ val: base, min: base - 18400, max: base + 18400 });
  }

  // Tableau Prix/m² par quartier (réutilisé dans Etat + Acheteur)
  const TableauQuartiers = () => (
    <div className="bento-card bento-full" style={{ padding: 0 }}>
      <div className="table-header-row">
        <h3 className="bento-title" style={{ marginBottom: 0 }}>Prix/m² par quartier — Toulon</h3>
        <span className="chart-badge" style={{ background: 'rgba(56,189,248,0.1)', color: 'var(--neon-blue)', border: '1px solid rgba(56,189,248,0.3)', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>DVF 2023–2024</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="quartiers-table">
          <thead>
            <tr>
              <th>Quartier</th>
              <th>Moy. €/m²</th>
              <th>Méd. €/m²</th>
              <th>Vol. tx</th>
              <th>Évol. 12m</th>
              <th>Marché</th>
            </tr>
          </thead>
          <tbody>
            {QUARTIERS.map(q => (
              <tr key={q.nom}>
                <td className="td-quartier">{q.nom}</td>
                <td className="td-mono td-bold">{q.moy.toLocaleString('fr-FR')} €</td>
                <td className="td-mono">{q.med.toLocaleString('fr-FR')} €</td>
                <td className="td-mono td-muted">{q.vol}</td>
                <td className={q.evol >= 0 ? 'delta-up' : 'delta-down'} style={{ fontSize: 13, fontWeight: 700 }}>
                  {q.evol >= 0 ? '+' : ''}{q.evol}%
                </td>
                <td>
                  <span className={`score-badge score-${q.score}`} style={{ background: q.score === 'hot' ? 'rgba(255,87,34,0.1)' : 'rgba(0,0,0,0.04)', color: q.score === 'hot' ? 'var(--neon-orange)' : 'var(--text-muted)' }}>
                    {q.score === 'hot' ? 'Actif' : q.score === 'ok' ? 'Stable' : 'Calme'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="dashboard">

      {/* ── Navigation onglets ── */}
      <div className="dash-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`dash-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════ MA RECHERCHE (Acheteur) ══════════════════════════ */}
      {activeTab === 'recherche' && (
        <>
          <div className="bento-grid">
            <div className="bento-card bento-square glow-orange">
              <p className="bento-title">Dans votre budget</p>
              <p className="bento-value orange">{nbBudget}</p>
              <p className="bento-sub">annonces / {annonces.length}</p>
            </div>
            <div className="bento-card bento-square">
              <p className="bento-title">Top correspondances</p>
              <p className="bento-value">{nbTopMatch}</p>
              <p className="bento-sub">score ≥ 85 / 100</p>
            </div>
            <div className="bento-card bento-square">
              <p className="bento-title">Score moyen</p>
              <p className="bento-value">{avgScore}</p>
              <p className="bento-sub">/ 100 pts</p>
            </div>
            <div className="bento-card bento-square">
              <p className="bento-title">Marché Toulon</p>
              <p className="bento-value">3 547</p>
              <p className="bento-sub">€/m² moyen · +4.2%</p>
            </div>

          {/* Budget vs quartiers */}
          <div className="bento-card bento-wide delay-1">
            <h3 className="bento-title">Accessibilité par quartier</h3>
            <p className="bento-sub" style={{ marginBottom: 16 }}>Prix moyen des annonces · ligne budget {profil.prixMax.toLocaleString('fr-FR')} €</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={quartierBudget} margin={{ top: 10, right: 10, left: -20, bottom: 80 }}>
                <XAxis dataKey="nom" tick={{ fontSize: 10, fill: '#334155', angle: -45, textAnchor: 'end' }} interval={0} height={85} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#334155' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={48} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} formatter={v => `${v.toLocaleString('fr-FR')} €`} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <ReferenceLine y={profil.prixMax} stroke="var(--neon-orange)" strokeWidth={2} strokeDasharray="3 4"
                  label={{ value: 'Budget', fill: 'var(--neon-orange)', fontSize: 10, position: 'insideTopRight' }} />
                <Bar dataKey="avgPrix" name="Prix moyen" radius={[4, 4, 0, 0]}>
                  {quartierBudget.map((q, i) => (
                    <Cell key={i} fill={q.accessible ? 'rgba(56, 189, 248, 0.8)' : 'rgba(239, 68, 68, 0.4)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 3 annonces */}
          <div className="bento-card bento-tall delay-2">
            <h3 className="bento-title">Vos correspondances</h3>
            <p className="bento-sub" style={{ marginBottom: 16 }}>Annonces les plus proches du profil</p>
            <div className="top-annonces-list">
              {topAnnonces.map((a, i) => {
                const sc = a.score;
                return (
                  <div key={a.id} className="top-annonce-item" style={{ padding: 12, borderRadius: 12, display: 'flex', gap: 12, cursor: 'pointer', marginBottom: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }} onClick={() => navigate(`/annonce/${a.id}`)}>
                    <img src={a.img} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{a.prix.toLocaleString('fr-FR')} €</div>
                      <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.type} · {a.quartier} · {a.surface} m²</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: sc >= 85 ? 'var(--neon-blue)' : '#0f172a' }}>{sc}</div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════ ÉTAT DU MARCHÉ ══════════════════════════ */}
      {activeTab === 'etat' && (
        <div className="bento-grid">
          {isAcheteur ? (
            <>
              {/* ── KPI acheteur : 3 indicateurs clés ── */}
              <div className="bento-card bento-square glow-orange delay-1">
                <p className="bento-title">Prix moyen / m²</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <p className="bento-value orange">3 547</p>
                  <span className="delta-up" style={{ fontSize: 13, fontWeight: 700 }}>+4.2%</span>
                </div>
                <p className="bento-sub">€/m² · Toulon global</p>
              </div>
              <div className="bento-card bento-square delay-2">
                <p className="bento-title">Quartier le + actif</p>
                <p className="bento-value">Mourillon</p>
                <p className="bento-sub">4 800 €/m² · +6.1% / 12 mois</p>
              </div>
              <div className="bento-card bento-square delay-3">
                <p className="bento-title">Quartier opportunité</p>
                <p className="bento-value" style={{ color: 'var(--neon-blue)' }}>Le Pradet</p>
                <p className="bento-sub">3 050 €/m² · Forte revalorisation</p>
              </div>

              {/* ── Graphiques : Répartition + Distribution ── */}
              <div className="bento-card bento-square delay-4">
                <h3 className="bento-title">Types de bien</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={TYPE_DATA} cx="50%" cy="50%"
                      innerRadius={65} outerRadius={90}
                      paddingAngle={4} dataKey="value"
                      stroke="transparent"
                      label={({ name, pct }) => `${name} ${pct}`}
                      labelLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                    >
                      <Cell fill="var(--neon-orange)" />
                      <Cell fill="var(--bg-card-hover)" />
                    </Pie>
                    <Tooltip formatter={v => v.toLocaleString('fr-FR')} content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bento-card bento-square delay-5">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 className="bento-title">Distribution prix/m² par quartier</h3>
                    <p className="bento-sub">Moyenne · €/m² · Toulon 2023–2024</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={QUARTIERS} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
                    <XAxis dataKey="nom" tick={{ fontSize: 10, fill: '#334155', angle: -45, textAnchor: 'end' }} interval={0} height={70} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#334155' }} tickFormatter={v => `${v}€`} domain={[0, 5500]} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} formatter={v => `${v.toLocaleString('fr-FR')} €/m²`} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="moy" name="Prix moyen" fill="var(--neon-orange)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ── Tableau filtrable en direct ── */}
              <div className="bento-card bento-full" style={{ padding: 0 }}>
                <div className="table-header-row">
                  <h3 className="bento-title" style={{ marginBottom: 0 }}>Prix/m² par quartier — Toulon</h3>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input
                      className="tx-search"
                      style={{ width: 220, padding: '8px 16px', fontSize: 13, borderRadius: 20 }}
                      placeholder="Filtrer un quartier…"
                      value={filterQ}
                      onChange={e => setFilterQ(e.target.value)}
                    />
                    <span className="chart-badge" style={{ background: 'rgba(56,189,248,0.1)', color: 'var(--neon-blue)', border: '1px solid rgba(56,189,248,0.3)', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>DVF 2023–2024</span>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="quartiers-table">
                    <thead>
                      <tr>
                        <th>Quartier</th>
                        <th>Moy. €/m²</th>
                        <th>Méd. €/m²</th>
                        <th>Vol. tx</th>
                        <th>Évol. 12m</th>
                        <th>Marché</th>
                      </tr>
                    </thead>
                    <tbody>
                      {QUARTIERS
                        .filter(q => q.nom.toLowerCase().includes(filterQ.toLowerCase()))
                        .map(q => (
                          <tr key={q.nom}>
                            <td className="td-quartier">{q.nom}</td>
                            <td className="td-mono td-bold">{q.moy.toLocaleString('fr-FR')} €</td>
                            <td className="td-mono">{q.med.toLocaleString('fr-FR')} €</td>
                            <td className="td-mono td-muted">{q.vol}</td>
                            <td className={q.evol >= 0 ? 'delta-up' : 'delta-down'} style={{ fontSize: 13, fontWeight: 700 }}>
                              {q.evol >= 0 ? '+' : ''}{q.evol}%
                            </td>
                            <td>
                              <span className={`score-badge score-${q.score}`} style={{ background: q.score === 'hot' ? 'rgba(255,87,34,0.1)' : 'rgba(0,0,0,0.04)', color: q.score === 'hot' ? 'var(--neon-orange)' : 'var(--text-muted)' }}>
                                {q.score === 'hot' ? 'Actif' : q.score === 'ok' ? 'Stable' : 'Calme'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* ── KPI agent (5 indicateurs) ── */}
              {KPI_ETAT.map((k, i) => (
                <div key={i} className={`bento-card bg-glow delay-${(i % 5) + 1} ${i < 2 ? 'bento-square' : 'span-3'}`} style={{ gridColumn: i < 2 ? 'span 6' : 'span 4' }}>
                  <p className="bento-title">{k.label}</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <p className={`bento-value ${k.green ? 'orange' : ''}`}>{k.value}</p>
                    <span className={k.up ? 'delta-up' : 'delta-down'} style={{ fontSize: 13, fontWeight: 700 }}>{k.delta}</span>
                  </div>
                  <p className="bento-sub">{k.unit} {k.sub}</p>
                </div>
              ))}

              <div className="bento-card bento-wide delay-3">
                <h3 className="bento-title">Évolution prix/m² mensuel</h3>
                <p className="bento-sub" style={{ marginBottom: 16 }}>Toulon • 2023–2024</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={PRIX_MENSUEL} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#334155' }} interval={2} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#334155' }} domain={[3200, 3800]} tickFormatter={v => `${v}€`} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="prix" name="€/m²" stroke="var(--neon-orange)" strokeWidth={4} dot={false} activeDot={{ r: 6, fill: 'var(--neon-orange)', stroke: '#ffffff', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bento-card bento-tall delay-4">
                <h3 className="bento-title">Volume partiel</h3>
                <p className="bento-sub" style={{ marginBottom: 16 }}>Transactions par trimestre</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={VOLUME_TRIM} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="trim" tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="vol" name="Transactions" fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.08)" strokeWidth={1} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <TableauQuartiers />
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════ TENDANCES ══════════════════════════ */}
      {activeTab === 'tendances' && (
        <div className="bento-grid">
          {KPI_TENDANCES.map((k, i) => (
            <div key={i} className={`bento-card bg-glow delay-${(i % 5) + 1} ${i < 2 ? 'bento-square' : 'span-3'}`} style={{ gridColumn: i < 2 ? 'span 6' : 'span 4' }}>
              <p className="bento-title">{k.label}</p>
              <p className={`bento-value ${k.green ? 'orange' : k.red ? 'text-red-500' : ''}`} style={{ fontSize: k.value.length > 6 ? 24 : 32 }}>{k.value}</p>
              <p className="bento-sub">{k.sub}</p>
            </div>
          ))}

          {/* ── Bar chart avec toggle Moyenne / Médiane ── */}
          <div className="bento-card bento-wide delay-3">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 className="bento-title">Distribution prix/m² par quartier</h3>
                <p className="bento-sub">{metricBar === 'moy' ? 'Moyenne' : 'Médiane'} — €/m²</p>
              </div>
              <div className="toggle-pills">
                <button className={`toggle-pill ${metricBar === 'moy' ? 'active' : ''}`} onClick={() => setMetricBar('moy')}>Moyenne</button>
                <button className={`toggle-pill ${metricBar === 'med' ? 'active' : ''}`} onClick={() => setMetricBar('med')}>Médiane</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={QUARTIERS} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
                <XAxis dataKey="nom" tick={{ fontSize: 10, fill: '#334155', angle: -45, textAnchor: 'end' }} interval={0} height={70} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#334155' }} tickFormatter={v => `${v}€`} domain={[0, 5500]} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} formatter={v => `${v.toLocaleString('fr-FR')} €/m²`} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                {metricBar === 'moy'
                  ? <Bar dataKey="moy" name="Moyen €/m²"   fill="var(--neon-orange)" radius={[4, 4, 0, 0]} />
                  : <Bar dataKey="med" name="Médiane €/m²" fill="rgba(88, 114, 145, 0.7)" radius={[4, 4, 0, 0]} />
                }
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Pie chart avec toggle Nb tx / Volume € ── */}
          <div className="bento-card bento-tall delay-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 className="bento-title">Répartition</h3>
                <p className="bento-sub">{metricPie === 'tx' ? 'Nombre' : 'Volume €'}</p>
              </div>
              <div className="toggle-pills" style={{ transform: 'scale(0.85)', transformOrigin: 'top right' }}>
                <button className={`toggle-pill ${metricPie === 'tx'  ? 'active' : ''}`} onClick={() => setMetricPie('tx')}>Nb tx</button>
                <button className={`toggle-pill ${metricPie === 'vol' ? 'active' : ''}`} onClick={() => setMetricPie('vol')}>Volume €</button>
              </div>
            </div>
            {(() => {
              const data = metricPie === 'tx' ? TYPE_DATA : TYPE_DATA_VOL;
              const fmt  = metricPie === 'tx'
                ? v => `${v.toLocaleString('fr-FR')} tx`
                : v => `${Math.round(v / 1000000).toLocaleString('fr-FR')} M€`;
              return (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data} cx="50%" cy="50%"
                        innerRadius={60} outerRadius={85}
                        paddingAngle={5} dataKey="value" stroke="transparent"
                        label={({ name, pct }) => `${name} ${pct}`}
                        labelLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                      >
                        <Cell fill="var(--neon-orange)" />
                        <Cell fill="var(--bg-card-hover)" />
                      </Pie>
                      <Tooltip formatter={fmt} content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pie-legend" style={{ marginTop: 16 }}>
                    {data.map(e => (
                      <div key={e.name} className="pie-legend-item" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                        <div className="pie-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: e.name === 'Appartement' ? 'var(--neon-orange)' : 'var(--bg-card-hover)' }} />
                        {e.name} — <span style={{ fontWeight: 700, color: '#0f172a' }}>{e.pct}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Scatter surface → prix */}
          <div className="bento-card bento-wide delay-5">
            <h3 className="bento-title">Corrélation surface → prix de vente</h3>
            <p className="bento-sub" style={{ marginBottom: 16 }}>Scatter plot • 200 points DVF • Droite de régression linéaire</p>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart margin={{ top: 10, right: 10, left: -20, bottom: 24 }}>
                <XAxis
                  type="number" dataKey="surface" name="Surface" unit="m²"
                  domain={[20, 210]} tick={{ fontSize: 10, fill: '#334155' }}
                  label={{ value: 'Surface (m²)', position: 'insideBottom', offset: -14, fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false}
                />
                <YAxis
                  type="number" dataKey="prix" name="Prix"
                  tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', border: `1px solid #e2e8f0`, borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#0f172a', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                      {d.surface !== undefined && <p style={{ color: '#64748b', marginBottom: 4 }}>Surface : {d.surface} m²</p>}
                      {d.prix !== undefined && <p style={{ color: 'var(--neon-orange)', fontWeight: 700, fontSize: 16 }}>{d.prix.toLocaleString('fr-FR')} €</p>}
                    </div>
                  );
                }} cursor={{ stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1 }} />
                <Line
                  data={REGR_LINE} dataKey="prix" name="Régression linéaire"
                  stroke="var(--neon-orange)" strokeWidth={3} dot={false} type="linear"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}


      {/* ══════════════════════════ OPPORTUNITÉS ══════════════════════════ */}
      {activeTab === 'opportunites' && (
        <div className="bento-grid">
          <div className="bento-card bento-wide delay-1" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--neon-blue)', fontSize: 20 }}>◈</span>
              <div>
                <h3 className="bento-title" style={{ color: 'var(--neon-blue)', marginBottom: 4 }}>Algorithme k-NN (k=5)</h3>
                <p className="bento-sub" style={{ fontSize: 13, lineHeight: 1.5, color: '#334155' }}>
                  Biens identifiés comme <strong>sous-évalués</strong> par rapport à leurs 5 plus proches voisins (surface, quartier, type). Connecté en temps réel au backend Python AI.
                </p>
              </div>
            </div>
          </div>
          
          {opportunitesLoading ? (
             <div className="bento-card bento-wide delay-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <p className="bento-title" style={{ fontSize: 18, color: 'var(--neon-orange)', animation: 'pulse 1.5s infinite' }}>Analyse géospatiale k-NN en cours...</p>
             </div>
          ) : opportunitesData?.length > 0 ? (
            opportunitesData.map((o, i) => (
              <div key={i} className={`bento-card bg-glow delay-${(i % 5) + 2} bento-square`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ background: '#fff2ea', color: 'var(--neon-orange)', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, border: '1px solid rgba(255, 87, 34, 0.3)' }}>
                    ◉ Sous-évalué {o.underval.toFixed(1)}%
                  </div>
                </div>
                
                <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum"' }}>
                  {fmtPrix(o.prix)}
                </div>
                
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                  {o.type} · {o.surf} m² · <span style={{ color: '#0f172a', fontWeight: 600 }}>{o.quartier}</span><br />
                  {o.pm2?.toLocaleString('fr-FR')} €/m² · <span style={{ fontStyle: 'italic' }}>moy. voisins : {Math.round(o.avgPm2).toLocaleString('fr-FR')} €/m²</span>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--neon-orange)', marginBottom: 6 }}>
                    <span>Potentiel de gain</span>
                    <span>Δ {o.underval.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, width: '100%', background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, o.underval)}%`, background: 'var(--neon-orange)', borderRadius: 3, boxShadow: 'none' }} />
                  </div>
                </div>
                
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 8, fontWeight: 700 }}>k-NN · biens similaires</div>
                  {o.neighbors?.slice(0, 3).map((n, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', padding: '4px 0' }}>
                      <span>{n.quartier?.split(',')[0]} · {n.surf}m²</span>
                      <span style={{ color: '#0f172a', fontWeight: 600 }}>{Math.round(n.pm2).toLocaleString('fr-FR')} €/m²</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="bento-card bento-wide delay-1">
               <p className="bento-sub">Aucune opportunité sous-évaluée détectée.</p>
            </div>
          )}
        </div>
      )}
      {/* ══════════════════════════ RÉGRESSION (Agent uniquement) ══════════════════════════ */}
      {activeTab === 'regression' && (
        <div className="bento-grid">
          {regressionLoading ? (
            <div className="bento-card bento-full delay-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
              <p className="bento-title" style={{ fontSize: 18, color: 'var(--neon-orange)', animation: 'pulse 1.5s infinite' }}>Connexion au modèle IA...</p>
            </div>
          ) : (
            <>
              {/* Le scatter plot */}
              <div className="bento-card bento-wide delay-1">
                <h3 className="bento-title">Modèle de Régression IA (DVF Toulon)</h3>
                <p className="bento-sub" style={{ marginBottom: 16 }}>{regressionData ? `n = ${regressionData.n_transactions} transactions · R² = ${regressionData.r_squared}` : 'Chargement...'}</p>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart margin={{ top: 10, right: 10, left: -20, bottom: 24 }}>
                    <XAxis
                      type="number" dataKey="surface" name="Surface" unit="m²"
                      domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#334155' }}
                      label={{ value: 'Surface (m²)', position: 'insideBottom', offset: -14, fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false}
                    />
                    <YAxis
                      type="number" dataKey="prix" name="Prix"
                      tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                    />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', border: `1px solid #e2e8f0`, borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#0f172a', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                          {d.surface !== undefined && <p style={{ color: '#64748b', marginBottom: 4 }}>Surface : {d.surface} m²</p>}
                          {d.prix !== undefined && <p style={{ color: 'var(--neon-orange)', fontWeight: 700, fontSize: 16 }}>{d.prix.toLocaleString('fr-FR')} €</p>}
                        </div>
                      );
                    }} cursor={{ stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1 }} />
                    <Scatter name="Transactions DVF" data={regressionData?.scatter_points || SCATTER_POINTS} fill="rgba(88, 114, 145, 0.5)" r={4} />
                    <Line
                      data={regressionData?.regression_line || REGR_LINE} dataKey="prix" name="Régression linéaire"
                      stroke="var(--neon-orange)" strokeWidth={3} dot={false} type="linear"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Estimateur Console Bento */}
              <div className="bento-card bento-tall delay-2 predictor-tool" style={{ background: '#ffffff' }}>
                <h3 className="bento-title" style={{ color: '#0f172a' }}>▸ Estimateur IA</h3>
                <div className="pred-field">
                  <label>Surface (m²)</label>
                  <input type="number" value={predSurf} onChange={e => setPredSurf(Number(e.target.value))} />
                </div>
                <div className="pred-field">
                  <label>Quartier</label>
                  <select value={predQ} onChange={e => setPredQ(e.target.value)}>
                    {Object.keys(QUARTIER_COEF).map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div className="pred-field">
                  <label>Type</label>
                  <select value={predType} onChange={e => setPredType(e.target.value)}>
                    <option value={0}>Appartement</option>
                    <option value={28600}>Maison (+28 600€)</option>
                  </select>
                </div>
                <div className="pred-field">
                  <label>Étage</label>
                  <input type="number" value={predEtage} min={0} max={20} onChange={e => setPredEtage(Number(e.target.value))} />
                </div>
                <button className="pred-btn" onClick={doPrediction}>[ CALCULER ]</button>
                {predResult && (
                  <div className="pred-result">
                    <div className="pred-result-label">PRIX ESTIMÉ CIBLE</div>
                    <div className="pred-result-val">{fmtPrix(Math.round(predResult.val))}</div>
                    <div className="pred-result-range">
                      [{fmtPrix(Math.round(predResult.min))} — {fmtPrix(Math.round(predResult.max))}]
                    </div>
                  </div>
                )}
              </div>


            </>
          )}
        </div>
      )}

    </div>
  );
}
