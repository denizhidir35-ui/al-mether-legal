export type CaseFile = {
  id: string;
  title: string;
  client: string;
  court: string;
  createdAt: string;
};

export function saveCase(
  file: CaseFile
) {

  const current =
    JSON.parse(
      localStorage.getItem(
        "al-mether-cases"
      ) || "[]"
    );

  current.unshift(file);

  localStorage.setItem(
    "al-mether-cases",
    JSON.stringify(current)
  );
}

export function getCases() {

  return JSON.parse(
    localStorage.getItem(
      "al-mether-cases"
    ) || "[]"
  );
}