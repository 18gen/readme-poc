import { spawn, execSync } from 'child_process';
import { promises as fs, readFileSync, existsSync } from 'fs';
import path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import getPort from 'get-port';

const TEMP_DIR = '/tmp/readme-mvp';
const PORT_RANGE = { min: 40000, max: 48000 };

export interface BuildResult {
  pid: number;
  hostPort: number;
}

export interface NodeAppInfo {
  hasDockerfile: boolean;
  pkgManager: 'pnpm' | 'yarn' | 'npm';
  startCmd: string;
  buildCmd?: string;
}

export class Runner {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  async ensureRepoCheckedOut(owner: string, repo: string, branch: string): Promise<string> {
    const workdir = path.join(TEMP_DIR, owner, repo, branch);
    
    try {
      await fs.mkdir(workdir, { recursive: true });
      
      const isRepo = await this.git.cwd(workdir).checkIsRepo();
      
      if (!isRepo) {
        // Clone the repository
        const repoUrl = `https://github.com/${owner}/${repo}.git`;
        await this.git.clone(repoUrl, workdir);
        await this.git.cwd(workdir).checkout(branch);
      } else {
        // Fetch and checkout the branch
        await this.git.cwd(workdir).fetch('origin', branch);
        await this.git.cwd(workdir).checkout(branch);
        await this.git.cwd(workdir).pull('origin', branch);
      }
      
      return workdir;
    } catch (error) {
      console.error(`Failed to checkout repository: ${owner}/${repo}#${branch}`, error);
      throw new Error(`Failed to checkout repository: ${owner}/${repo}#${branch}`);
    }
  }

  detectNodeApp(workdir: string): NodeAppInfo {
    const packageJsonPath = path.join(workdir, 'package.json');
    
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const scripts = packageJson.scripts || {};
      
      // Check for package manager
      let pkgManager: 'pnpm' | 'yarn' | 'npm' = 'npm';
      if (existsSync(path.join(workdir, 'pnpm-lock.yaml'))) {
        pkgManager = 'pnpm';
      } else if (existsSync(path.join(workdir, 'yarn.lock'))) {
        pkgManager = 'yarn';
      }
      
      // Determine start command
      let startCmd = 'npm start';
      if (scripts.start) {
        startCmd = `${pkgManager} start`;
      } else if (scripts.dev) {
        startCmd = `${pkgManager} run dev`;
      }
      
      // Check for build command
      let buildCmd: string | undefined;
      if (scripts.build) {
        buildCmd = `${pkgManager} run build`;
      }
      
      // Check for Dockerfile
      const hasDockerfile = existsSync(path.join(workdir, 'Dockerfile'));
      
      return {
        hasDockerfile,
        pkgManager,
        startCmd,
        buildCmd
      };
    } catch (error) {
      console.error('Failed to detect Node.js app:', error);
      throw new Error('Not a valid Node.js application');
    }
  }

  async pickPort(): Promise<number> {
    const port = await getPort({ port: [PORT_RANGE.min, PORT_RANGE.max] });
    if (!port) {
      throw new Error('No available ports in range');
    }
    return port;
  }

  async buildAndRunNodeApp(
    workdir: string, 
    env: Record<string, string>, 
    onLog: (log: string) => void
  ): Promise<BuildResult> {
    try {
      const appInfo = this.detectNodeApp(workdir);
      
      // Install dependencies
      onLog(`Installing dependencies with ${appInfo.pkgManager}...`);
      const installCmd = appInfo.pkgManager === 'pnpm' 
        ? 'pnpm install --frozen-lockfile'
        : appInfo.pkgManager === 'yarn'
        ? 'yarn install --frozen-lockfile'
        : 'npm ci --no-audit --no-fund';
      
      execSync(installCmd, { 
        cwd: workdir, 
        stdio: 'pipe',
        env: { ...process.env, ...env }
      });
      
      // Build if build command exists
      if (appInfo.buildCmd) {
        onLog(`Building application...`);
        const childEnv = { ...process.env, ...env };
        // ユーザーが環境変数に NODE_ENV を入れていても無視する
        delete (childEnv as any).NODE_ENV;
        // Next.js は build 時に production を期待
        childEnv.NODE_ENV = "production";

        execSync(appInfo.buildCmd, {
          cwd: workdir,
          stdio: "pipe",
          env: childEnv,
        });
      }
      
      // Pick a port
      const hostPort = await this.pickPort();
      onLog(`Starting application on port ${hostPort}...`);
      
      // Start the application
      const child = spawn(appInfo.startCmd, [], {
        cwd: workdir,
        stdio: 'pipe',
        shell: true,
        env: { 
          ...process.env, 
          ...env, 
          PORT: hostPort.toString() 
        }
      });
      
      // Stream logs
      child.stdout?.on('data', (data) => {
        onLog(`[STDOUT] ${data.toString()}`);
      });
      
      child.stderr?.on('data', (data) => {
        onLog(`[STDERR] ${data.toString()}`);
      });
      
      // Wait for the app to be ready
      await this.waitForAppReady(hostPort, onLog);
      
      onLog(`Application is running on port ${hostPort}`);
      
      return {
        pid: child.pid!,
        hostPort
      };
    } catch (error) {
      console.error('Failed to build and run app:', error);
      throw error;
    }
  }

  private async waitForAppReady(port: number, onLog: (log: string) => void): Promise<void> {
    const maxRetries = 10;
    const retryDelay = 1000;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`http://localhost:${port}/`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // App not ready yet
      }
      
      if (i < maxRetries - 1) {
        onLog(`Waiting for application to be ready... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw new Error('Application failed to start within timeout');
  }

  async stopProcess(pid: number): Promise<void> {
    try {
      // Kill the process and its children
      execSync(`pkill -P ${pid}`, { stdio: 'pipe' });
      execSync(`kill ${pid}`, { stdio: 'pipe' });
    } catch (error) {
      console.error(`Failed to stop process ${pid}:`, error);
      // Try force kill
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
      } catch (forceError) {
        console.error(`Failed to force kill process ${pid}:`, forceError);
      }
    }
  }
}

export const runner = new Runner();
