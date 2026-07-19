import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
// pdf-parse ships a CJS default export; imported this way it works under Next's ESM/CJS interop.
import pdfParse from "pdf-parse";
import { extractKnownSkillsFromText } from "@jobscout/core";

export type ParsedResume = {
  skills: string[];
  targetTitles: string[];
  seniority: string;
  yearsOfExperience: number | null;
  summary: string;
  source: "claude" | "heuristic";
};

const MAX_CHARS = 15_000; // guard against huge/garbled documents blowing up the prompt

export async function extractResumeText(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (lower.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
}

const RESUME_TOOL: Anthropic.Tool = {
  name: "record_resume_profile",
  description:
    "Records structured job-matching profile fields extracted from a resume/CV so they can prefill a job seeker's profile.",
  input_schema: {
    type: "object",
    properties: {
      skills: {
        type: "array",
        items: { type: "string" },
        description:
          "Concrete skills, tools, technologies, and languages mentioned (e.g. 'React', 'German', 'Postgres', 'Patient care'). Not vague soft traits like 'hard-working'. 6-15 items, most relevant first."
      },
      targetTitles: {
        type: "array",
        items: { type: "string" },
        description:
          "1-3 job titles this person is qualified for based on their experience, in English (translate German titles to their closest English equivalent, e.g. 'Softwareentwickler' -> 'Software Developer')."
      },
      seniority: {
        type: "string",
        enum: ["intern", "junior", "mid", "senior", "lead"],
        description: "Best-fit seniority level given total years and scope of experience."
      },
      yearsOfExperience: {
        type: "number",
        description: "Best estimate of total years of relevant professional experience."
      },
      summary: {
        type: "string",
        description: "One sentence summarizing this candidate's professional background."
      }
    },
    required: ["skills", "targetTitles", "seniority", "summary"]
  }
};

/**
 * Extracts structured profile fields from resume text via the Claude API
 * (tool-use forces well-formed output). Falls back to a free, offline
 * keyword-based extraction (packages/core's skill taxonomy) if there's no
 * API key configured or the call fails, so the upload never hard-fails.
 */
export async function parseResumeText(text: string): Promise<ParsedResume> {
  const trimmed = text.trim().slice(0, MAX_CHARS);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!trimmed) {
    return heuristicParse("");
  }

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        tools: [RESUME_TOOL],
        tool_choice: { type: "tool", name: RESUME_TOOL.name },
        messages: [
          {
            role: "user",
            content: `Extract structured profile data from this resume text (it may be German, English, or a mix):\n\n${trimmed}`
          }
        ]
      });

      const toolUse = message.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUse) {
        const input = toolUse.input as Partial<{
          skills: string[];
          targetTitles: string[];
          seniority: string;
          yearsOfExperience: number;
          summary: string;
        }>;

        return {
          skills: (input.skills ?? []).filter(Boolean),
          targetTitles: (input.targetTitles ?? []).filter(Boolean),
          seniority: input.seniority ?? "mid",
          yearsOfExperience: input.yearsOfExperience ?? null,
          summary: input.summary ?? "",
          source: "claude"
        };
      }
    } catch (error) {
      console.error("Claude resume parsing failed, falling back to heuristic extraction:", error);
    }
  }

  return heuristicParse(trimmed);
}

function heuristicParse(text: string): ParsedResume {
  const skills = extractKnownSkillsFromText(text);
  return {
    skills,
    targetTitles: [],
    seniority: "mid",
    yearsOfExperience: null,
    summary: skills.length
      ? "Parsed offline (no ANTHROPIC_API_KEY configured) — only skills we recognized were extracted. Review and add target titles yourself."
      : "Couldn't extract anything useful offline — add an ANTHROPIC_API_KEY for real resume parsing, or fill in your profile manually.",
    source: "heuristic"
  };
}
