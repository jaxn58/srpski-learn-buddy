/**
 * Redirect component for vocabulary quiz
 * Handles redirection from old quiz URLs to new vocabulary pages
 */

import { useEffect } from "react";
import { useLocation } from "wouter";

export default function VocabularyQuizRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Parse query parameters
    const params = new URLSearchParams(window.location.search);
    const unit = params.get("unit");
    
    // Redirect to vocabulary page with unit parameter
    if (unit) {
      setLocation(`/vocabulary?unit=${unit}`);
    } else {
      setLocation("/vocabulary");
    }
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}








