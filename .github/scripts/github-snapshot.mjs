// GitHub theke repo / commit er ekta copy (github.json) banay.
// Website age eta dekhay, tai GitHub er 60-call limit shesh holeo page faka thake na.
// Chalano: GITHUB_TOKEN=... node .github/scripts/github-snapshot.mjs
import { readFile, writeFile } from 'node:fs/promises';

const D = JSON.parse(await readFile('data.json', 'utf8'));
const user = D.github;
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-snapshot' };
if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;

async function api(path) {
  const r = await fetch('https://api.github.com/' + path, { headers });
  if (!r.ok) throw new Error(path + ' -> ' + r.status);
  return { body: await r.json(), link: r.headers.get('link') || '' };
}

const u = (await api('users/' + user)).body;
const repos = (await api(`users/${user}/repos?sort=pushed&per_page=100`)).body;
const out = {
  user: { avatar_url: u.avatar_url, public_repos: u.public_repos, followers: u.followers },
  // lukano repo (ei website nije shoho) bad: na hole protibar commit e file bodlay ar loop hoy
  repos: repos.filter(r => !r.fork && !D.hideRepos.includes(r.name)).map(r => ({
    name: r.name, html_url: r.html_url, description: r.description, language: r.language, fork: r.fork,
    stargazers_count: r.stargazers_count, forks_count: r.forks_count, pushed_at: r.pushed_at,
  })),
  commits: {}, commitCount: {},
};
const wanted = new Set(D.projects.filter(p => p.repo).map(p => p.repo));
for (const s of D.stats) if (s.github === 'commits') wanted.add(s.repo);
for (const repo of wanted) {
  const cs = (await api(`repos/${user}/${repo}/commits?per_page=5`)).body;
  out.commits[repo] = cs.map(c => ({ html_url: c.html_url, commit: { message: c.commit.message.split('\n')[0], author: { date: c.commit.author.date } } }));
  const one = await api(`repos/${user}/${repo}/commits?per_page=1`);
  const m = /[?&]page=(\d+)>; rel="last"/.exec(one.link);
  out.commitCount[repo] = m ? +m[1] : one.body.length;
}
await writeFile('github.json', JSON.stringify(out, null, 1) + '\n');
console.log('github.json:', out.repos.length, 'repos,', JSON.stringify(out.commitCount));
