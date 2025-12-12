/**
 * Prompt Admin Page
 * Admin interface for managing AI prompts and templates
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function PromptAdmin() {
  const { t } = useTranslation();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement save functionality
      // This would save prompts to Convex or another backend
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulated delay
      
      toast.success("Prompts saved successfully");
    } catch (error) {
      console.error("Error saving prompts:", error);
      toast.error("Failed to save prompts");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Prompt Administration</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>System Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="system-prompt">
                Configure the AI system prompt for chat interactions
              </Label>
              <Textarea
                id="system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter system prompt..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Prompt Template</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="user-prompt">
                Configure the default user prompt template
              </Label>
              <Textarea
                id="user-prompt"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Enter user prompt template..."
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setSystemPrompt("");
              setUserPrompt("");
            }}
          >
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Prompts"}
          </Button>
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">Usage Tips:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>System prompts define the AI's behavior and personality</li>
          <li>Use variables like {`{user_name}`} and {`{context}`} in templates</li>
          <li>Test prompts thoroughly before deploying to production</li>
          <li>Keep prompts concise but informative</li>
        </ul>
      </div>
    </div>
  );
}


