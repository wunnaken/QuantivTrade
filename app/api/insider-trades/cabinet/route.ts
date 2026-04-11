import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 2025 Trump administration cabinet members with known financial disclosure obligations
const CABINET_MEMBERS = [
  { name: "Scott Bessent", searchName: "Scott Bessent", role: "Secretary of the Treasury", agency: "Treasury", party: "R" },
  { name: "Marco Rubio", searchName: "Marco Rubio", role: "Secretary of State", agency: "State", party: "R" },
  { name: "Howard Lutnick", searchName: "Howard Lutnick", role: "Secretary of Commerce", agency: "Commerce", party: "R" },
  { name: "Doug Burgum", searchName: "Doug Burgum", role: "Secretary of the Interior", agency: "Interior", party: "R" },
  { name: "Chris Wright", searchName: "Chris Wright", role: "Secretary of Energy", agency: "Energy", party: "R" },
  { name: "Linda McMahon", searchName: "Linda McMahon", role: "Secretary of Education", agency: "Education", party: "R" },
  { name: "Kristi Noem", searchName: "Kristi Noem", role: "Secretary of Homeland Security", agency: "DHS", party: "R" },
  { name: "Tulsi Gabbard", searchName: "Tulsi Gabbard", role: "Director of National Intelligence", agency: "ODNI", party: "R" },
  { name: "John Ratcliffe", searchName: "John Ratcliffe", role: "Director of the CIA", agency: "CIA", party: "R" },
  { name: "Pete Hegseth", searchName: "Pete Hegseth", role: "Secretary of Defense", agency: "Defense", party: "R" },
  { name: "Pam Bondi", searchName: "Pam Bondi", role: "Attorney General", agency: "DOJ", party: "R" },
  { name: "Robert F. Kennedy", searchName: "Robert Kennedy", role: "Secretary of Health and Human Services", agency: "HHS", party: "R" },
  { name: "Sean Duffy", searchName: "Sean Duffy", role: "Secretary of Transportation", agency: "Transportation", party: "R" },
  { name: "Brooke Rollins", searchName: "Brooke Rollins", role: "Secretary of Agriculture", agency: "Agriculture", party: "R" },
];

type EdgarHit = {
  _source: {
    adsh: string;
    file_date: string;
    period_ending?: string;
    form: string;
    display_names?: string[];
    entity_name?: string;
    biz_locations?: string[];
  };
};

async function searchEdgarByName(name: string) {
  const encoded = encodeURIComponent(`"${name}"`);
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encoded}&forms=4&dateRange=custom&startdt=2024-01-01`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "QuantivTrade research@quantiv.io" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = await res.json() as { hits?: { hits?: EdgarHit[] } };
    const hits = json.hits?.hits ?? [];
    return hits.slice(0, 10).map((h) => ({
      accession: h._source.adsh,
      filingDate: h._source.file_date,
      periodDate: h._source.period_ending ?? null,
      formType: h._source.form,
      displayNames: h._source.display_names ?? [],
      // Extract company name (the non-person entry in display_names)
      company: (h._source.display_names ?? [])
        .find((n) => !n.match(/^[A-Z][a-z]+ [A-Z]/))
        ?.replace(/ \(CIK.*\)/, "") ?? null,
      link: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum=&State=0&SIC=&dateb=&owner=include&count=40&search_text=&action=getcompany&company=${encodeURIComponent(name)}&CIK=&type=4&dateb=&owner=include&count=40`,
      edgarLink: `https://www.sec.gov/Archives/edgar/data/${h._source.adsh.replace(/-/g, "").substring(0, 10)}/${h._source.adsh.replace(/-/g, "")}.txt`,
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  // Fetch EDGAR filings for each cabinet member in parallel
  const results = await Promise.allSettled(
    CABINET_MEMBERS.map(async (member) => ({
      ...member,
      filings: await searchEdgarByName(member.searchName),
    }))
  );

  const officials = results.map((r, i) => {
    const member = CABINET_MEMBERS[i];
    if (r.status === "fulfilled") {
      return r.value;
    }
    return { ...member, filings: [] };
  });

  // Count total filings found
  const totalFilings = officials.reduce((s, o) => s + o.filings.length, 0);

  return NextResponse.json({
    officials,
    totalFilings,
    source: "SEC EDGAR Full-Text Search",
    note: "Cabinet members must file OGE Form 278e annual financial disclosures and may file SEC Form 4s for any public company holdings. Many divest holdings upon confirmation to avoid conflicts of interest. Data covers 2024-present.",
    ogeLink: "https://efts.sec.gov/LATEST/search-index",
    updateFrequency: "Daily",
  });
}
