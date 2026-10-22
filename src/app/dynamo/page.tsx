import type { Metadata } from "next";
import { DynamoWorkspace } from "@/components/dynamo/workspace";
import "./dynamo.css";

export const metadata: Metadata = {
  title: "DynamoScope — A companion to the Dynamo paper",
  description:
    "Read Amazon’s 2007 Dynamo paper with a section-by-section guide, interactive distributed systems labs, and a searchable glossary.",
};

export default function DynamoPage() {
  return <DynamoWorkspace />;
}
