import { describe, expect, it } from "vitest";
import { createSlug } from "./create-slug";
import { createWorkspaceBaseSlug } from "./create-workspace-slug";

describe("createSlug", () => {
  it("slugifies latin names", () => {
    expect(createSlug("My Workspace")).toBe("my-workspace");
    expect(createSlug("  Trim_me!  ")).toBe("trim-me");
  });

  it("keeps letters from non-latin scripts", () => {
    // A bare `\w` is ASCII-only, so these used to collapse to "" and the
    // server rejected the update with "expected string to have >=1 characters".
    expect(createSlug("广云家")).toBe("广云家");
    expect(createSlug("瑚琏")).toBe("瑚琏");
    expect(createSlug("Проект")).toBe("проект");
    expect(createSlug("프로젝트")).toBe("프로젝트");
  });

  it("hyphenates across scripts and drops punctuation", () => {
    expect(createSlug("广云家 Team")).toBe("广云家-team");
    expect(createSlug("广云家（测试）")).toBe("广云家测试");
  });

  it("still returns an empty string when nothing survives", () => {
    expect(createSlug("!!!")).toBe("");
  });
});

describe("createWorkspaceBaseSlug", () => {
  it("falls back so the slug is never empty", () => {
    expect(createWorkspaceBaseSlug("!!!")).toBe("workspace");
    expect(createWorkspaceBaseSlug("广云家")).toBe("广云家");
  });
});
