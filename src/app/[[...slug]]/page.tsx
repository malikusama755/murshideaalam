import pages from "@/content/pages.json";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type LegacyPage = {
  href: string;
  title: string;
  source: string;
  html: string;
};

const legacyPages = pages as LegacyPage[];

function hrefFromSlug(slug?: string[]) {
  if (!slug || slug.length === 0) return "/";
  return `/${slug.join("/")}`;
}

export function generateStaticParams() {
  return legacyPages
    .filter((page) => page.href !== "/")
    .map((page) => ({ slug: page.href.slice(1).split("/") }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = legacyPages.find((item) => item.href === hrefFromSlug(slug));
  return {
    title: page?.title ?? "Page not found",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = legacyPages.find((item) => item.href === hrefFromSlug(slug));
  if (!page) notFound();

  return <article className="legacy" dangerouslySetInnerHTML={{ __html: page.html }} />;
}
