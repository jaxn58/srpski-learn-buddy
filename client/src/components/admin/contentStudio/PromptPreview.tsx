import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PenTool, Wrench, Shield, Layers, ExternalLink, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface RolePrompt {
  content: string;
  source: string;
  key: string;
}

export interface PromptPreviewProps {
  promptPreview: {
    roles?: {
      creator: RolePrompt;
      fixer: RolePrompt;
      lector: RolePrompt;
    };
    baseSystemPrompt: string;
    skillsBlock: string | null;
    referenceBlock: string | null;
    sectionPrompts: Record<string, string | { content: string; source: string }>;
    source: { base: string };
  } | null | undefined;
}

interface PromptStatusRowProps {
  icon: React.ReactNode;
  label: string;
  dbKey: string;
  source: string;
  charCount: number;
}

function PromptStatusRow({ icon, label, dbKey, source, charCount }: PromptStatusRowProps) {
  const isDb = source === "database";
  const isMissing = source === "missing";
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <span className="text-sm font-medium truncate">{label}</span>
        <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono hidden sm:inline">
          {dbKey}
        </code>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-muted-foreground tabular-nums hidden md:inline">
          {charCount.toLocaleString()} chars
        </span>
        {isDb ? (
          <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50">
            Active
          </Badge>
        ) : isMissing ? (
          <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 bg-red-50 flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            Missing
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            Unknown
          </Badge>
        )}
      </div>
    </div>
  );
}

export function PromptPreview({ promptPreview }: PromptPreviewProps) {
  if (!promptPreview) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Loading...
        </CardContent>
      </Card>
    );
  }

  const roles = promptPreview.roles;

  const sectionEntries = Object.entries(promptPreview.sectionPrompts).map(([id, val]) => ({
    id,
    content: typeof val === "string" ? val : val.content,
    source: typeof val === "string" ? "missing" : val.source,
  }));

  const hasMissing =
    (roles && Object.values(roles).some((r) => r.source === "missing")) ||
    sectionEntries.some((e) => e.source === "missing");

  return (
    <div className="space-y-4">
      {hasMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Some prompts are missing from the database. Actions will fail until they are created.
            Open Prompt Administration and create the missing prompts.
          </span>
        </div>
      )}

      <Card>
        <CardContent className="pt-4 pb-2">
          {roles ? (
            <>
              <PromptStatusRow
                icon={<PenTool className="h-4 w-4" />}
                label="Unit Creator"
                dbKey={roles.creator.key}
                source={roles.creator.source}
                charCount={roles.creator.content.length}
              />
              <PromptStatusRow
                icon={<Wrench className="h-4 w-4" />}
                label="Finding Fixer"
                dbKey={roles.fixer.key}
                source={roles.fixer.source}
                charCount={roles.fixer.content.length}
              />
              <PromptStatusRow
                icon={<Shield className="h-4 w-4" />}
                label="Lector (Auditor)"
                dbKey={roles.lector.key}
                source={roles.lector.source}
                charCount={roles.lector.content.length}
              />
            </>
          ) : (
            <PromptStatusRow
              icon={<PenTool className="h-4 w-4" />}
              label="Base System Prompt"
              dbKey="cs_unit_creator"
              source={promptPreview.source.base === "database (chatPrompts)" ? "database" : "missing"}
              charCount={promptPreview.baseSystemPrompt.length}
            />
          )}
        </CardContent>
      </Card>

      {sectionEntries.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-2">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Section Prompts</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {sectionEntries.length} sections
              </Badge>
            </div>
            {sectionEntries
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((entry) => (
                <PromptStatusRow
                  key={entry.id}
                  icon={<span className="h-4 w-4" />}
                  label={entry.id.charAt(0).toUpperCase() + entry.id.slice(1)}
                  dbKey={`cs_section_${entry.id}`}
                  source={entry.source}
                  charCount={entry.content.length}
                />
              ))}
          </CardContent>
        </Card>
      )}

      {(promptPreview.skillsBlock || promptPreview.referenceBlock) && (
        <div className="text-xs text-muted-foreground px-1 space-y-1">
          {promptPreview.skillsBlock && (
            <div className="flex items-center justify-between">
              <span>Active Skills</span>
              <span className="tabular-nums">{promptPreview.skillsBlock.length.toLocaleString()} chars</span>
            </div>
          )}
          {promptPreview.referenceBlock && (
            <div className="flex items-center justify-between">
              <span>Reference Guidelines</span>
              <span className="tabular-nums">{promptPreview.referenceBlock.length.toLocaleString()} chars</span>
            </div>
          )}
        </div>
      )}

      <div className={cn("border-t pt-4 flex items-center justify-between gap-3")}>
        <p className="text-xs text-muted-foreground">
          To view or edit prompt content, use the Prompt Administration.
        </p>
        <Link href="/admin/prompt">
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Prompt Admin
          </Button>
        </Link>
      </div>
    </div>
  );
}
