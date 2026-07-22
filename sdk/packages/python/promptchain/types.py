from dataclasses import dataclass, field
from typing import Optional
from solders.pubkey import Pubkey


@dataclass
class TargetModel:
    provider: str
    model_id: str
    version: Optional[str] = None
    parameters: Optional[dict] = None


@dataclass
class Benchmark:
    metric: str
    score: float
    dataset: Optional[str] = None
    methodology: Optional[str] = None


@dataclass
class PromptMetadata:
    name: str
    description: str
    prompt_text: str
    target_model: Optional[TargetModel] = None
    benchmarks: Optional[list[Benchmark]] = None
    category: str = ""
    tags: list[str] = field(default_factory=list)
    task_description: str = ""
    changelog: Optional[str] = None
    fork_of: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    language: str = "en"


@dataclass
class Prompt:
    authority: Pubkey
    original_authority: Pubkey
    ipfs_cid: str
    metadata_uri: str
    license: Pubkey
    total_versions: int
    total_uses: int


@dataclass
class PromptVersion:
    parent: Pubkey
    version_number: int
    author: Pubkey
    ipfs_cid: str
    metadata_uri: str
    changelog_uri: str


@dataclass
class License:
    authority: Pubkey
    name: str
    commercial_allowed: bool
    attribution_required: bool
    royalty_basis_points: int


@dataclass
class Curator:
    authority: Pubkey
    stake_amount: int
    total_ratings: int
    reputation_score: int


@dataclass
class Rating:
    curator: Pubkey
    prompt: Pubkey
    rating_value: int
    review_uri: str
    timestamp: int
