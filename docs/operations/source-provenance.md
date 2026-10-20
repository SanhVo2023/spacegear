# Source and execution record

The audited application came from the uncommitted working tree at `../platform-clone`. The original is unchanged. `source-manifest.json` records the copied paths, sizes and SHA-256 hashes before implementation.

Implementation lives on `feat/spacegear-revival` in the sibling `spacegear` worktree, created from planning commit `ab7affe`. The native worktree tool failed because the session's parent folder is not a Git repository; `git worktree add` succeeded against the actual repository. A sibling worktree avoids changing the original checkout's ignore rules.

The supplied remote is `https://github.com/SanhVo2023/platform-design-contest.git`. Earlier API/ref inspection showed an empty repository. Direct clone attempts failed to connect to GitHub. This local worktree is not represented as a successful remote clone. No source has been uploaded.

Original raw art is preserved under ignored `assets/source/` and in the unchanged original checkout. Public outputs must contain only optimized art used by Spacegear. The original baseline passed type checking/build and had four lint errors and one warning, documented in the audit; implementation resolves them.

Owner directions: open audience, no company-scale marketing, Cloudflare only, preserve aesthetics/motion, bypass Cockpit. Production domain, contact destination and approved policy facts are pending. Preview builds stay non-indexable; production validation must reject missing settings.

Legacy URLs: `/work/neural-core/`, `/work/design-engine/`, `/work/scale-matrix/`, `/work/neural-net/`, `/work/shield-core/` and the four `/labs/*` articles describe fictional template content. Retire them with real 404 responses; there is no equivalent consulting page that warrants a redirect. Preserve useful home hash destinations for services, process, pricing/engagements, faq and contact. Update all links to canonical routes.
