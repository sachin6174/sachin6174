const https = require('https');
const fs = require('fs');
const path = require('path');

const USERNAME = 'sachinkumar6174';

const query = `
query getFullLeetCodeData($username: String!) {
  allQuestionsCount {
    difficulty
    count
  }
  matchedUser(username: $username) {
    username
    profile {
      ranking
      userAvatar
      realName
      countryName
      reputation
    }
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    languageProblemCount {
      languageName
      problemsSolved
    }
    userCalendar {
      activeYears
      streak
      totalActiveDays
      submissionCalendar
    }
    badges {
      id
      displayName
      icon
      creationDate
    }
  }
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
  }
}
`;

function fetchLeetCodeData(username) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      query,
      variables: { username }
    });

    const options = {
      hostname: 'leetcode.com',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors) {
            reject(new Error(JSON.stringify(parsed.errors)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

function calculateDonutArcs(easyCount, medCount, hardCount, totalCount, radius) {
  const circumference = 2 * Math.PI * radius;
  const easyRatio = totalCount > 0 ? easyCount / totalCount : 0;
  const medRatio = totalCount > 0 ? medCount / totalCount : 0;
  const hardRatio = totalCount > 0 ? hardCount / totalCount : 0;

  const easyLength = easyRatio * circumference;
  const medLength = medRatio * circumference;
  const hardLength = hardRatio * circumference;

  return {
    circumference,
    easy: { length: easyLength, offset: 0 },
    med: { length: medLength, offset: -easyLength },
    hard: { length: hardLength, offset: -(easyLength + medLength) }
  };
}

function buildCalendarHeatmap(submissionCalendarStr, now = new Date()) {
  const calendarData = JSON.parse(submissionCalendarStr || '{}');
  
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const currentDayOfWeek = today.getDay(); // 0 = Sun, 6 = Sat
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (52 * 7 + currentDayOfWeek));

  const days = [];
  const curr = new Date(startDate);
  
  let totalSubmissionsLastYear = 0;
  let activeDaysLastYear = 0;

  while (curr <= endDate) {
    const timestamp = Math.floor(curr.getTime() / 1000);
    let count = 0;
    for (const [ts, c] of Object.entries(calendarData)) {
      const diff = Math.abs(Number(ts) - timestamp);
      if (diff < 43200) {
        count += c;
      }
    }

    if (count > 0) {
      totalSubmissionsLastYear += count;
      activeDaysLastYear++;
    }

    days.push({
      date: new Date(curr),
      count,
      dayOfWeek: curr.getDay(),
      month: curr.getMonth(),
      dayOfMonth: curr.getDate()
    });

    curr.setDate(curr.getDate() + 1);
  }

  return { days, totalSubmissionsLastYear, activeDaysLastYear };
}

function getHeatmapColor(count) {
  if (count === 0) return '#2e2e2e'; // empty
  if (count <= 1) return '#0e4429'; // level 1
  if (count <= 3) return '#00733a'; // level 2
  if (count <= 6) return '#00a854'; // level 3
  return '#2cbb5d'; // level 4
}

function generateLeetCodeSVG(data) {
  const user = data.matchedUser;
  const questions = data.allQuestionsCount;
  const contest = data.userContestRanking;

  const totalQuestions = questions.find(q => q.difficulty === 'All')?.count || 4029;
  const easyTotal = questions.find(q => q.difficulty === 'Easy')?.count || 960;
  const medTotal = questions.find(q => q.difficulty === 'Medium')?.count || 2103;
  const hardTotal = questions.find(q => q.difficulty === 'Hard')?.count || 966;

  const acStats = user.submitStatsGlobal.acSubmissionNum;
  const allSolved = acStats.find(s => s.difficulty === 'All')?.count || 0;
  const easySolved = acStats.find(s => s.difficulty === 'Easy')?.count || 0;
  const medSolved = acStats.find(s => s.difficulty === 'Medium')?.count || 0;
  const hardSolved = acStats.find(s => s.difficulty === 'Hard')?.count || 0;
  const totalSubmissions = acStats.find(s => s.difficulty === 'All')?.submissions || 0;

  const totalActiveDays = user.userCalendar.totalActiveDays || 0;
  const streak = user.userCalendar.streak || 0;
  const ranking = user.profile.ranking ? user.profile.ranking.toLocaleString() : 'N/A';
  const contestRating = contest && contest.rating ? Math.round(contest.rating).toLocaleString() : 'N/A';

  const { days, totalSubmissionsLastYear } = buildCalendarHeatmap(user.userCalendar.submissionCalendar);

  const width = 860;
  const height = 375;

  // Donut chart values
  const radius = 38;
  const cx = 58;
  const cy = 60;
  const strokeWidth = 7.5;
  const arcs = calculateDonutArcs(easySolved, medSolved, hardSolved, allSolved, radius);

  // Weeks grid
  const cellWidth = 8.2;
  const cellGap = 1.9;
  const step = cellWidth + cellGap; // 10.1px
  const gridStartX = 296;
  const gridStartY = 136;

  let heatmapCells = '';
  let monthLabels = '';
  let lastMonth = -1;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const weekIndex = Math.floor(i / 7);
    const dayIndex = d.dayOfWeek;

    const x = gridStartX + weekIndex * step;
    const y = gridStartY + dayIndex * step;
    const fill = getHeatmapColor(d.count);

    heatmapCells += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellWidth}" height="${cellWidth}" rx="1.8" ry="1.8" fill="${fill}"><title>${d.date.toISOString().split('T')[0]}: ${d.count} submissions</title></rect>\n`;

    // Month label when new month starts in the week
    if (dayIndex === 0 && d.month !== lastMonth) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      monthLabels += `<text x="${x.toFixed(1)}" y="${gridStartY - 7}" class="cal-month">${monthNames[d.month]}</text>\n`;
      lastMonth = d.month;
    }
  }

  // Badges rendering
  const badges = user.badges || [];
  let badgesMarkup = '';
  const badgesToShow = badges.slice(0, 4);

  badgesToShow.forEach((b, idx) => {
    const bx = idx * 133;
    const name = b.displayName.replace(' Badge', '').replace(' 2026', ' \'26').replace(' 2025', ' \'25');
    badgesMarkup += `
      <g transform="translate(${bx}, 0)">
        <rect x="0" y="0" width="126" height="36" rx="6" fill="#1f1f1f" stroke="#333333" stroke-width="1"/>
        <text x="14" y="23" font-size="14">🏅</text>
        <text x="32" y="15" class="badge-title">${escapeXml(name)}</text>
        <text x="32" y="27" class="badge-sub">${b.creationDate || 'LeetCode'}</text>
      </g>
    `;
  });

  // Top Languages
  const languages = user.languageProblemCount || [];

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap');
      
      * {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .bg {
        fill: #1a1a1a;
        stroke: #2e2e2e;
        stroke-width: 1.5;
        rx: 14;
      }
      
      .card-bg {
        fill: #262626;
        stroke: #363636;
        stroke-width: 1;
        rx: 10;
      }
      
      .title-text {
        font-size: 15px;
        font-weight: 700;
        fill: #ffffff;
      }
      
      .subtitle-text {
        font-size: 11.5px;
        font-weight: 500;
        fill: #999999;
      }
      
      .stat-big {
        font-size: 20px;
        font-weight: 800;
        fill: #ffffff;
      }
      
      .stat-sub {
        font-size: 9.5px;
        font-weight: 600;
        fill: #8a8a8a;
      }
      
      .diff-label {
        font-size: 11px;
        font-weight: 600;
      }
      
      .diff-easy { fill: #00b8a3; }
      .diff-med { fill: #ffc01e; }
      .diff-hard { fill: #ef4743; }
      
      .diff-count {
        font-size: 12px;
        font-weight: 700;
        fill: #ffffff;
      }
      
      .diff-total {
        font-size: 10px;
        font-weight: 500;
        fill: #6e6e6e;
      }
      
      .diff-bar-bg {
        fill: #383838;
        rx: 2;
      }
      
      .cal-month {
        font-size: 9.5px;
        font-weight: 500;
        fill: #808080;
      }
      
      .cal-day {
        font-size: 8.5px;
        font-weight: 500;
        fill: #6a6a6a;
      }
      
      .cal-summary-num {
        font-size: 13.5px;
        font-weight: 700;
        fill: #ffffff;
      }
      
      .cal-summary-lbl {
        font-size: 11.5px;
        font-weight: 500;
        fill: #909090;
      }
      
      .badge-title {
        font-size: 10px;
        font-weight: 600;
        fill: #dedede;
      }
      
      .badge-sub {
        font-size: 9px;
        font-weight: 500;
        fill: #808080;
      }
      
      .header-chip {
        fill: #242424;
        stroke: #383838;
        stroke-width: 1;
        rx: 6;
      }
    </style>
    
    <!-- Gradients -->
    <linearGradient id="easyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00b8a3"/>
      <stop offset="100%" stop-color="#26e2cb"/>
    </linearGradient>
    <linearGradient id="medGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffc01e"/>
      <stop offset="100%" stop-color="#ffd56b"/>
    </linearGradient>
    <linearGradient id="hardGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ef4743"/>
      <stop offset="100%" stop-color="#ff6b67"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" class="bg"/>

  <!-- Header -->
  <g transform="translate(20, 18)">
    <!-- LeetCode Icon -->
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.261a1.38 1.38 0 0 0-.012 1.948 1.372 1.372 0 0 0 1.947.012l5.406-5.823a.46.46 0 0 1 .326-.149.46.46 0 0 1 .459.459c0 .121-.048.232-.128.313l-9.14 9.14a3.68 3.68 0 0 0 0 5.207l1.458 1.458a3.68 3.68 0 0 0 5.207 0l8.777-8.777a1.372 1.372 0 0 0-1.94-1.94l-8.777 8.777a.92.92 0 0 1-1.302 0L7.66 19.43a.92.92 0 0 1 0-1.302L16.8 8.988a3.68 3.68 0 0 0 0-5.207L14.444.438A1.374 1.374 0 0 0 13.483 0z" fill="#FFA116"/>
      <path d="M4.094 13.069a1.372 1.372 0 0 0-1.94 1.94l2.5 2.5a1.372 1.372 0 1 0 1.94-1.94l-2.5-2.5z" fill="#B3B3B3"/>
    </svg>

    <text x="34" y="15" class="title-text">${escapeXml(user.profile.realName || user.username)}</text>
    <text x="34" y="28" class="subtitle-text">@${user.username} • Global Rank #${ranking} • 🇮🇳</text>

    <!-- Top Chips -->
    <g transform="translate(${width - 325}, -2)">
      <rect x="0" y="0" width="90" height="28" class="header-chip"/>
      <text x="45" y="18" text-anchor="middle" font-size="11" fill="#ffa116" font-weight="700">🔥 ${streak}d Streak</text>
      
      <rect x="96" y="0" width="100" height="28" class="header-chip"/>
      <text x="146" y="18" text-anchor="middle" font-size="11" fill="#00b8a3" font-weight="700">⚡ ${totalActiveDays}d Active</text>

      <rect x="202" y="0" width="96" height="28" class="header-chip"/>
      <text x="250" y="18" text-anchor="middle" font-size="11" fill="#eff1f6" font-weight="700">⚔️ ${contestRating} Rating</text>
    </g>
  </g>

  <!-- Left Card: Solved Problems -->
  <g transform="translate(20, 60)">
    <rect x="0" y="0" width="240" height="270" class="card-bg"/>
    <text x="14" y="22" font-size="12" font-weight="700" fill="#ffffff">Solved Problems</text>

    <!-- Donut Gauge Chart -->
    <g transform="translate(0, 32)">
      <!-- Background Track -->
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#363636" stroke-width="${strokeWidth}" />
      
      <!-- Easy Arc -->
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="url(#easyGrad)" stroke-width="${strokeWidth}"
        stroke-dasharray="${arcs.easy.length} ${arcs.circumference}"
        stroke-dashoffset="${arcs.easy.offset}"
        stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})" />

      <!-- Medium Arc -->
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="url(#medGrad)" stroke-width="${strokeWidth}"
        stroke-dasharray="${arcs.med.length} ${arcs.circumference}"
        stroke-dashoffset="${arcs.med.offset}"
        stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})" />

      <!-- Hard Arc -->
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="url(#hardGrad)" stroke-width="${strokeWidth}"
        stroke-dasharray="${arcs.hard.length} ${arcs.circumference}"
        stroke-dashoffset="${arcs.hard.offset}"
        stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})" />

      <!-- Center Text -->
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="stat-big">${allSolved}</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" class="stat-sub">SOLVED</text>
      <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="8.5" fill="#666666">/${totalQuestions}</text>
    </g>

    <!-- Difficulty Bars on the Right side of Left card -->
    <g transform="translate(122, 38)">
      <!-- Easy -->
      <g transform="translate(0, 0)">
        <text x="0" y="9" class="diff-label diff-easy">Easy</text>
        <text x="104" y="9" text-anchor="end">
          <tspan class="diff-count">${easySolved}</tspan>
          <tspan class="diff-total">/${easyTotal}</tspan>
        </text>
        <rect x="0" y="14" width="104" height="4" class="diff-bar-bg"/>
        <rect x="0" y="14" width="${Math.min(104, Math.round((easySolved / easyTotal) * 104))}" height="4" fill="url(#easyGrad)" rx="2"/>
      </g>

      <!-- Medium -->
      <g transform="translate(0, 32)">
        <text x="0" y="9" class="diff-label diff-med">Med.</text>
        <text x="104" y="9" text-anchor="end">
          <tspan class="diff-count">${medSolved}</tspan>
          <tspan class="diff-total">/${medTotal}</tspan>
        </text>
        <rect x="0" y="14" width="104" height="4" class="diff-bar-bg"/>
        <rect x="0" y="14" width="${Math.min(104, Math.round((medSolved / medTotal) * 104))}" height="4" fill="url(#medGrad)" rx="2"/>
      </g>

      <!-- Hard -->
      <g transform="translate(0, 64)">
        <text x="0" y="9" class="diff-label diff-hard">Hard</text>
        <text x="104" y="9" text-anchor="end">
          <tspan class="diff-count">${hardSolved}</tspan>
          <tspan class="diff-total">/${hardTotal}</tspan>
        </text>
        <rect x="0" y="14" width="104" height="4" class="diff-bar-bg"/>
        <rect x="0" y="14" width="${Math.max(2, Math.min(104, Math.round((hardSolved / hardTotal) * 104)))}" height="4" fill="url(#hardGrad)" rx="2"/>
      </g>
    </g>

    <!-- Top Languages Breakdown -->
    <g transform="translate(14, 155)">
      <line x1="0" y1="0" x2="212" y2="0" stroke="#333333" stroke-width="1"/>
      <text x="0" y="16" font-size="10" font-weight="700" fill="#888888">TOP LANGUAGES</text>
      
      <g transform="translate(0, 24)">
        ${languages.slice(0, 2).map((l, i) => `
          <g transform="translate(${i * 108}, 0)">
            <text x="0" y="10" font-size="11" font-weight="600" fill="#e0e0e0">${l.languageName}</text>
            <text x="0" y="22" font-size="9.5" font-weight="500" fill="#888888">${l.problemsSolved} solved</text>
          </g>
        `).join('')}
      </g>
      <g transform="translate(0, 56)">
        ${languages.slice(2, 4).map((l, i) => `
          <g transform="translate(${i * 108}, 0)">
            <text x="0" y="10" font-size="11" font-weight="600" fill="#e0e0e0">${l.languageName}</text>
            <text x="0" y="22" font-size="9.5" font-weight="500" fill="#888888">${l.problemsSolved} solved</text>
          </g>
        `).join('')}
      </g>
    </g>
  </g>

  <!-- Right Card: Submissions Heatmap & Badges -->
  <g transform="translate(270, 60)">
    <rect x="0" y="0" width="570" height="270" class="card-bg"/>

    <!-- Heatmap Title & Summary Header -->
    <g transform="translate(16, 20)">
      <text x="0" y="2" class="cal-summary-lbl">
        <tspan class="cal-summary-num">${totalSubmissionsLastYear}</tspan> submissions in the past year
      </text>
      <text x="538" y="2" text-anchor="end" class="cal-summary-lbl">
        Max streak: <tspan class="cal-summary-num">${streak}</tspan> days
      </text>
    </g>

    <!-- Calendar Month Labels -->
    <g transform="translate(-270, -60)">
      ${monthLabels}
    </g>

    <!-- Calendar Day Labels -->
    <g transform="translate(8, 54)">
      <text x="0" y="8" class="cal-day">Mon</text>
      <text x="0" y="28" class="cal-day">Wed</text>
      <text x="0" y="48" class="cal-day">Fri</text>
    </g>

    <!-- Calendar Cells Grid -->
    <g transform="translate(-270, -60)">
      ${heatmapCells}
    </g>

    <!-- Heatmap Legend -->
    <g transform="translate(422, 138)">
      <text x="0" y="8" font-size="9.5" fill="#777777">Less</text>
      <rect x="25" y="0" width="8.2" height="8.2" rx="1.8" fill="#2e2e2e"/>
      <rect x="36" y="0" width="8.2" height="8.2" rx="1.8" fill="#0e4429"/>
      <rect x="47" y="0" width="8.2" height="8.2" rx="1.8" fill="#00733a"/>
      <rect x="58" y="0" width="8.2" height="8.2" rx="1.8" fill="#00a854"/>
      <rect x="69" y="0" width="8.2" height="8.2" rx="1.8" fill="#2cbb5d"/>
      <text x="81" y="8" font-size="9.5" fill="#777777">More</text>
    </g>

    <!-- Badges Row at Bottom -->
    <g transform="translate(16, 155)">
      <line x1="0" y1="0" x2="538" y2="0" stroke="#333333" stroke-width="1"/>
      <text x="0" y="16" font-size="10" font-weight="700" fill="#888888">BADGES (${badges.length})</text>
      
      <g transform="translate(0, 24)">
        ${badgesMarkup}
      </g>
    </g>
  </g>

  <!-- Bottom Footer -->
  <g transform="translate(${width / 2}, ${height - 10})">
    <text x="0" y="0" text-anchor="middle" font-size="9" font-weight="500" fill="#555555">
      leetcode.com/u/${user.username} • Verified LeetCode GraphQL Data
    </text>
  </g>
</svg>
  `.trim();
}

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function main() {
  try {
    console.log(`Fetching LeetCode data for ${USERNAME}...`);
    const data = await fetchLeetCodeData(USERNAME);
    console.log('Fetched data successfully. Generating SVG...');
    const svg = generateLeetCodeSVG(data);

    const outDir = path.join(__dirname, '..', 'assets');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const outputPath = path.join(outDir, 'leetcode.svg');
    fs.writeFileSync(outputPath, svg, 'utf8');
    console.log(`SVG written successfully to ${outputPath}`);
  } catch (err) {
    console.error('Error generating LeetCode SVG:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchLeetCodeData, generateLeetCodeSVG };
