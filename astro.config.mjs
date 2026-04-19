import { defineConfig } from "astro/config";
import react from "@astrojs/react";

const repository = process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const owner = repository[0];
const repo = repository[1];
const isGitHubActions = process.env.GITHUB_ACTIONS === "true";
const isUserPagesRepo = owner && repo && owner.toLowerCase() === repo.toLowerCase().replace(/\.github\.io$/, "");

export default defineConfig({
  integrations: [react()],
  site: isGitHubActions && owner ? `https://${owner}.github.io` : undefined,
  base:
    isGitHubActions && repo && !isUserPagesRepo
      ? `/${repo}`
      : undefined,
  server: {
    host: true
  }
});
