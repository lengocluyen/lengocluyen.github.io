# -*- coding: utf-8 -*-
"""Build _data/research_keywords.yml, the data behind the research-theme cloud
on the publications page.

    python _scripts/build_research_keywords.py           # use cached abstracts
    python _scripts/build_research_keywords.py --fetch   # also fetch new ones

How it works
  * Each publication's text = its title + its abstract. Abstracts come from the
    arXiv and HAL records already linked in _data/publications.yml, and are
    cached in _scripts/abstracts_cache.json so reruns are offline.
  * Each THEME below is a regex over that text (English and French variants).
    A paper counts for a theme when the title matches, or when the abstract
    mentions it at least twice. A single passing mention does not count.
  * A theme is counted once per paper, so one long abstract cannot dominate.
  * Each theme belongs to one research phase, set by hand in THEMES.

To add a theme, add a line to THEMES and rerun. Run it again after adding
papers to _data/publications.yml.
"""
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBS = os.path.join(ROOT, "_data", "publications.yml")
OUT = os.path.join(ROOT, "_data", "research_keywords.yml")
CACHE = os.path.join(ROOT, "_scripts", "abstracts_cache.json")
UA = {"User-Agent": "research-keyword-builder/1.0"}
MIN_PAPERS = 2  # themes with fewer papers are left out of the cloud

# Research phases, in chronological order: (id, label, years)
PHASES = [
    ("nlp", "NLP & semantics", "2015–2020"),
    ("recsys", "Ontology-based recommendation", "2021–2025"),
    ("edu", "Competency, education & LLMs", "2025–"),
]

# label -> (phase, regex). Matching is case-insensitive, and Unicode hyphens
# are normalised to "-" first. Phases are assigned by hand: the year alone
# would put the 2025 multi-criteria recommender papers in the "edu" phase.
THEMES = {
    # NLP & semantics (2015-2020)
    "CCG parsing": ("nlp", r"\bccg\b|combinatory categorial|supertag"),
    "Discourse representation": ("nlp", r"\bdrs\b|discourse representation|repr[ée]sentation du discours"),
    "Natural language processing": ("nlp", r"natural language processing|\bnlp\b|relation extraction|syntactic pars|traitement automatique|extraction de relations|d[ée]ficit d.information|discussion thread|fil de discussion"),
    "Big data": ("nlp", r"big data|biological data|indexing tool"),
    "Phenotyping data": ("nlp", r"ph[ée]notyp"),
    # Ontology-based recommendation (2021-2025)
    "Recommender systems": ("recsys", r"recommend|recommandation"),
    "Ontologies": ("recsys", r"ontolog"),
    "Knowledge graphs": ("recsys", r"knowledge-graphs?|knowledge graphs?|graphes? de connaissances"),
    "Knowledge bases": ("recsys", r"knowledge-bases?|knowledge bases?|bases? de connaissances"),
    "Semantic Web & RDF": ("recsys", r"\brdf\b|semantic web|\bowl\b|\bsparql\b|web s[ée]mantique"),
    "Context-aware": ("recsys", r"context-aware|contextual|integrating context|sensible au contexte"),
    "Multi-criteria": ("recsys", r"multi-?crit[eè]r"),
    "Group recommendation": ("recsys", r"group recommend|group profil|groups? of users|from individual to group|recommandation de groupe"),
    "Constraint-based methods": ("recsys", r"constrain"),
    "User profiling": ("recsys", r"user (?:contextual )?profil|profil(?:e|ing)? ontolog|profil utilisateur"),
    "Semantic similarity": ("recsys", r"semantic similarity|similarity measure|similar crises"),
    "Deep learning": ("recsys", r"deep (?:learning|feature|neural)|neural network"),
    "Attention mechanisms": ("recsys", r"\battention\b"),
    "Multi-task learning": ("recsys", r"multi-task"),
    "Vehicle domain": ("recsys", r"vehicle|v[ée]hicule|automotive"),
    "Crisis management": ("recsys", r"\bcris[ie]s\b|\bcrises?\b"),
    "Population sheltering": ("recsys", r"shelter|mise [àa] l.abri|evacuat"),
    # Competency, education & LLMs (2025-)
    "Large language models": ("edu", r"\bllms?\b|large language models?|grands? mod[eè]les? de langu"),
    "Generative AI": ("edu", r"generative (?:ai|artificial)|\bgenai\b|ia g[ée]n[ée]rative"),
    "Human-AI collaboration": ("edu", r"human-(?:generative-)?ai collaboration|human-generative ai|human-ai\b|human-in-the-loop"),
    "Competencies & skills": ("edu", r"competenc|comp[ée]tence|\bskills?\b"),
    "Skill decomposition": ("edu", r"skill decomposition|decompos"),
    "Prerequisite skills": ("edu", r"prerequisite"),
    "Education": ("edu", r"educat|pedagog|p[ée]dagog|[ée]ducati"),
    "Learning analytics": ("edu", r"learning analytics|\blms\b|interaction logs|learning management"),
    "Early warning": ("edu", r"early-warning|early warning|early (?:outcome )?prediction|at-risk|risk prediction"),
    "Student modeling": ("edu", r"\bstudents?\b|\blearners?\b|apprenants?"),
    "Intelligent tutoring": ("edu", r"tutoring"),
    "Explainability": ("edu", r"explainab|explanation|explicab|interpretab"),
    "Dense retrieval": ("edu", r"dense retrieval|retriever|hard negative"),
    "Counterfactual recourse": ("edu", r"counterfactual|recourse"),
    "Digital twins": ("edu", r"digital twin"),
    "Mixed reality": ("edu", r"mixed reality|r[ée]alit[ée] mixte"),
}



def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def ids_for(item):
    urls = [item.get("url", "")] + [l["url"] for l in item.get("links", []) or []]
    arxiv = hal = None
    for u in urls:
        m = re.search(r"arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5})", u)
        if m and not arxiv:
            arxiv = m.group(1)
        m = re.search(r"/((?:hal|tel|lirmm|inria)-\d{8})", u)
        if m and not hal:
            hal = m.group(1)
    return arxiv, hal


def fetch_abstracts(pubs, cache):
    want_arxiv, want_hal = {}, {}
    for title, item in pubs:
        if cache.get(title):
            continue
        a, h = ids_for(item)
        if a:
            want_arxiv[a] = title
        elif h:
            want_hal[h] = title
    ns = {"a": "http://www.w3.org/2005/Atom"}
    ids = list(want_arxiv)
    for k in range(0, len(ids), 8):  # small batches; arXiv is slow on big ones
        batch = ids[k:k + 8]
        q = urllib.parse.urlencode({"id_list": ",".join(batch), "max_results": len(batch)})
        for attempt in range(3):
            try:
                root = ET.fromstring(get("https://export.arxiv.org/api/query?" + q))
                break
            except Exception as ex:
                print("arXiv batch %d, attempt %d failed: %s" % (k // 8, attempt + 1, ex))
                time.sleep(5)
        else:
            continue
        for e in root.findall("a:entry", ns):
            aid = re.sub(r"v\d+$", "", (e.findtext("a:id", "", ns) or "").rsplit("/abs/", 1)[-1])
            if aid in want_arxiv:
                cache[want_arxiv[aid]] = " ".join((e.findtext("a:summary", "", ns) or "").split())
        time.sleep(3)  # arXiv asks for at most one request every three seconds
    # Papers with a HAL record but no arXiv abstract (including arXiv misses).
    want_hal = {h: t for h, t in want_hal.items() if not cache.get(t)}
    for _, item in pubs:
        a, h = ids_for(item)
        if a and h and not cache.get(item["title"]):
            want_hal[h] = item["title"]
    if want_hal:
        q = "halId_s:(%s)" % " OR ".join(want_hal)
        url = ("https://api.archives-ouvertes.fr/search/?wt=json&rows=100&fl=halId_s,abstract_s&q="
               + urllib.parse.quote(q))
        try:
            for d in json.loads(get(url))["response"]["docs"]:
                if d.get("halId_s") in want_hal and d.get("abstract_s"):
                    cache[want_hal[d["halId_s"]]] = " ".join(" ".join(d["abstract_s"]).split())
        except Exception as ex:
            print("HAL lookup failed:", ex)
    return cache


def norm(text):
    """Unicode hyphens and dashes -> ASCII '-', so 'Context‐Aware' matches."""
    return re.sub(r"[‐-―−]", "-", text)


def main():
    data = yaml.safe_load(io.open(PUBS, encoding="utf-8"))
    pubs = [(i["title"], i) for s in data for i in s["items"]]
    cache = json.load(io.open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    if "--fetch" in sys.argv:
        cache = fetch_abstracts(pubs, cache)
        io.open(CACHE, "w", encoding="utf-8").write(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True))

    themes = []
    for label, (phase, rx) in THEMES.items():
        pat = re.compile(rx, re.I)
        papers, years = [], []
        for title, item in pubs:
            hit = pat.search(norm(title)) or len(pat.findall(norm(cache.get(title, "")))) >= 2
            if hit:
                papers.append(title)
                years.append(int(str(item["year"])[:4]))
        if len(papers) < MIN_PAPERS:
            continue
        themes.append({
            "label": label,
            "slug": re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-"),
            "phase": phase,
            "count": len(papers),
            "first": min(years),
            "last": max(years),
            "papers": papers,
        })

    # Size tiers 1..5 by paper count. Square-root scale, so the long tail of
    # 2-4 paper themes still spreads over several sizes.
    top = max(t["count"] for t in themes)
    for t in themes:
        share = (t["count"] - MIN_PAPERS) / max(1, top - MIN_PAPERS)
        t["size"] = max(1, min(5, 1 + round(4 * share ** 0.5)))
    # Phase order (chronological), then alphabetical: the cloud reads as a timeline.
    order = {p: n for n, (p, _, _) in enumerate(PHASES)}
    themes.sort(key=lambda t: (order[t["phase"]], t["label"].lower()))

    header = ("# GENERATED by _scripts/build_research_keywords.py -- do not edit by hand.\n"
              "# Rerun the script after changing _data/publications.yml.\n")
    out = {"phases": [{"id": p, "label": l, "years": y} for p, l, y in PHASES], "themes": themes}
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(
        header + yaml.safe_dump(out, allow_unicode=True, sort_keys=False, width=1000))

    print("abstracts: %d / %d papers" % (sum(1 for t, _ in pubs if cache.get(t)), len(pubs)))
    for t in sorted(themes, key=lambda t: -t["count"]):
        print("%3d  s%d  %-7s %d-%d  %s" % (t["count"], t["size"], t["phase"], t["first"], t["last"], t["label"]))


if __name__ == "__main__":
    main()
