import type {
  AppendVersionInput,
  AssetLineage,
  CanvasProject,
  ProjectAsset,
} from "@/app/projects/project-types";

export function latestVersion(asset: ProjectAsset) {
  return asset.versions.reduce((latest, version) =>
    version.version > latest.version ? version : latest,
  );
}

export function appendAssetVersion(
  project: CanvasProject,
  assetId: string,
  input: AppendVersionInput,
): CanvasProject {
  const target = project.assets.find((asset) => asset.id === assetId);
  if (!target) throw new Error(`Unknown asset: ${assetId}`);

  const nextVersion = latestVersion(target).version + 1;
  const nextAsset: ProjectAsset = {
    ...target,
    versions: [
      ...target.versions,
      {
        ...input,
        id: `${assetId}-v${nextVersion}`,
        version: nextVersion,
      },
    ],
  };

  return {
    ...project,
    updatedAt: input.createdAt,
    assets: project.assets.map((asset) =>
      asset.id === assetId ? nextAsset : asset,
    ),
    activity: [
      {
        id: `${project.id}-activity-${project.activity.length + 1}`,
        kind: "versioned",
        actor: input.createdBy,
        occurredAt: input.createdAt,
        message: `Created ${target.title} v${nextVersion}`,
      },
      ...project.activity,
    ],
  };
}

export function getAssetLineage(
  project: CanvasProject,
  assetId: string,
): AssetLineage | null {
  const asset = project.assets.find((candidate) => candidate.id === assetId);
  if (!asset) return null;

  const assetById = new Map(project.assets.map((candidate) => [candidate.id, candidate]));
  return {
    asset,
    parents: asset.parentAssetIds.flatMap((id) => {
      const parent = assetById.get(id);
      return parent ? [parent] : [];
    }),
    children: project.assets.filter((candidate) =>
      candidate.parentAssetIds.includes(assetId),
    ),
  };
}

export function getProjectEdges(project: CanvasProject) {
  return project.assets.flatMap((asset) =>
    asset.parentAssetIds.flatMap((parentId) => {
      const parent = project.assets.find((candidate) => candidate.id === parentId);
      return parent
        ? [{ id: `${parentId}-${asset.id}`, parent, child: asset } as const]
        : [];
    }),
  );
}
