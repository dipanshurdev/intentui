import { readFile, writeFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import * as process from "node:process"

/**
 * List of directories to scan for components that might need 'use client'
 */
const TARGET_DIRECTORIES = ["./src/components/docs", "./src/components/ui"]
const FIX_MODE = process.argv.includes("--fix")

/**
 * Heuristic to check if a file needs 'use client' directive.
 * Checks for common React hooks and event handlers.
 */
function needsUseClientDirective(content: string): boolean {
  const clientIndicators = [
    "useState",
    "useEffect",
    "useContext",
    "useRef",
    "useMemo",
    "useCallback",
    "useLayoutEffect",
    "useImperativeHandle",
    "useReducer",
    "onClick=",
    "onChange=",
    "onBlur=",
    "onFocus=",
    "onSubmit=",
    "onKeyDown=",
    "onKeyUp=",
    "onMouseEnter=",
    "onMouseLeave=",
    "onScroll=",
  ]

  return clientIndicators.some((indicator) => content.includes(indicator))
}

async function findFilesWithoutUseClient(dirPath: string): Promise<string[]> {
  const missingFiles: string[] = []

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const subDirMissing = await findFilesWithoutUseClient(fullPath)
        missingFiles.push(...subDirMissing)
      } else if (entry.name.endsWith(".tsx")) {
        const content = await readFile(fullPath, "utf8")

        // Already has it, skip
        if (content.includes('"use client"') || content.includes("'use client'")) {
          continue
        }

        if (needsUseClientDirective(content)) {
          if (FIX_MODE) {
            console.info(`✅ Adding 'use client' to: ${fullPath}`)
            await writeFile(fullPath, `"use client"\n\n${content}`)
          } else {
            missingFiles.push(fullPath)
          }
        }
      }
    }
  } catch (err) {
    if ((err as any).code !== "ENOENT") {
      console.error(`❌ Error scanning ${dirPath}:`, err)
    }
  }

  return missingFiles
}

async function run() {
  console.info("🔍 Checking for missing 'use client' directives...")
  let totalMissing = 0

  for (const dir of TARGET_DIRECTORIES) {
    const missing = await findFilesWithoutUseClient(dir)
    totalMissing += missing.length
    for (const file of missing) {
      console.warn(`⚠️  Missing 'use client' in: ${file}`)
    }
  }

  if (totalMissing > 0) {
    console.error(`\n❌ Found ${totalMissing} files missing 'use client'.`)
    console.info("💡 Run 'npm run cuc -- --fix' to automatically add them.")
    process.exit(1)
  } else {
    console.info("\n✨ All checked components have 'use client' where needed.\n")
  }
}

run()
