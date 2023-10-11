"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  InvalidPathError: () => invalidPathError_default,
  NoMatchError: () => noMatchError_default,
  checkZfsPool: () => checkZfsPool,
  default: () => src_default,
  getFirstExistingParentPath: () => getFirstExistingParentPath_default
});
module.exports = __toCommonJS(src_exports);
var import_node_child_process = require("child_process");
var import_node_fs = require("fs");
var import_node_os = require("os");
var import_node_path = require("path");
var import_node_process = require("process");
var import_node_util = require("util");

// src/errors/invalidPathError.ts
var InvalidPathError = class _InvalidPathError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidPathError";
    Object.setPrototypeOf(this, _InvalidPathError.prototype);
  }
};
var invalidPathError_default = InvalidPathError;

// src/errors/noMatchError.ts
var NoMatchError = class _NoMatchError extends Error {
  constructor(message) {
    super(message);
    this.name = "NoMatchError";
    Object.setPrototypeOf(this, _NoMatchError.prototype);
  }
};
var noMatchError_default = NoMatchError;

// src/functions/isDirectoryExisting.ts
async function isDirectoryExisting(directoryPath, dependencies) {
  try {
    await dependencies.fsAccess(directoryPath);
    return Promise.resolve(true);
  } catch (error) {
    return Promise.resolve(false);
  }
}
var isDirectoryExisting_default = isDirectoryExisting;

// src/functions/getFirstExistingParentPath.ts
async function getFirstExistingParentPath(directoryPath, dependencies) {
  let parentDirectoryPath = directoryPath;
  let parentDirectoryFound = await isDirectoryExisting_default(parentDirectoryPath, dependencies);
  while (!parentDirectoryFound) {
    parentDirectoryPath = dependencies.pathNormalize(parentDirectoryPath + "/..");
    parentDirectoryFound = await isDirectoryExisting_default(parentDirectoryPath, dependencies);
  }
  return parentDirectoryPath;
}
var getFirstExistingParentPath_default = getFirstExistingParentPath;

// src/functions/hasPowerShell3.ts
async function hasPowerShell3(dependencies) {
  const major = parseInt(dependencies.release.split(".")[0], 10);
  if (major <= 6) {
    return false;
  }
  try {
    await dependencies.cpExecFile("where", ["powershell"], { windowsHide: true });
    return true;
  } catch (error) {
    return false;
  }
}
var hasPowerShell3_default = hasPowerShell3;

// src/index.ts
function checkDiskSpace(directoryPath, dependencies = {
  platform: import_node_process.platform,
  release: (0, import_node_os.release)(),
  fsAccess: (0, import_node_util.promisify)(import_node_fs.access),
  pathNormalize: import_node_path.normalize,
  pathSep: import_node_path.sep,
  cpExecFile: (0, import_node_util.promisify)(import_node_child_process.execFile)
}) {
  function mapOutput(stdout, filter, mapping, coefficient) {
    const parsed = stdout.split("\n").map((line) => line.trim()).filter((line) => line.length !== 0).slice(1).map((line) => line.split(/\s+(?=[\d/])/));
    const filtered = parsed.filter(filter);
    if (filtered.length === 0) {
      throw new noMatchError_default();
    }
    const diskData = filtered[0];
    return {
      diskPath: diskData[mapping.diskPath],
      free: parseInt(diskData[mapping.free], 10) * coefficient,
      size: parseInt(diskData[mapping.size], 10) * coefficient
    };
  }
  async function check(cmd, filter, mapping, coefficient = 1) {
    const [file, ...args] = cmd;
    if (file === void 0) {
      return Promise.reject(new Error("cmd must contain at least one item"));
    }
    try {
      const { stdout } = await dependencies.cpExecFile(file, args, {
        windowsHide: true
      });
      return mapOutput(stdout, filter, mapping, coefficient);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  async function checkWin32(directoryPath2) {
    if (directoryPath2.charAt(1) !== ":") {
      return Promise.reject(
        new invalidPathError_default(
          "The following path is invalid (should be X:\\...): ".concat(directoryPath2)
        )
      );
    }
    const powershellCmd = [
      "powershell",
      "Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object Caption, FreeSpace, Size"
    ];
    const wmicCmd = ["wmic", "logicaldisk", "get", "size,freespace,caption"];
    const cmd = await hasPowerShell3_default(dependencies) ? powershellCmd : wmicCmd;
    return check(
      cmd,
      (driveData) => {
        const driveLetter = driveData[0];
        return directoryPath2.toUpperCase().startsWith(driveLetter.toUpperCase());
      },
      {
        diskPath: 0,
        free: 1,
        size: 2
      }
    );
  }
  async function checkUnix(directoryPath2) {
    if (!dependencies.pathNormalize(directoryPath2).startsWith(dependencies.pathSep)) {
      return Promise.reject(
        new invalidPathError_default(
          "The following path is invalid (should start by ".concat(dependencies.pathSep, "): ").concat(directoryPath2)
        )
      );
    }
    const pathToCheck = await getFirstExistingParentPath_default(
      directoryPath2,
      dependencies
    );
    return check(
      ["df", "-Pk", "--", pathToCheck],
      () => true,
      // We should only get one line, so we did not need to filter
      {
        diskPath: 5,
        free: 3,
        size: 1
      },
      1024
      // We get sizes in kB, we need to convert that to bytes
    );
  }
  if (dependencies.platform === "win32") {
    return checkWin32(directoryPath);
  }
  return checkUnix(directoryPath);
}
async function checkZfsPool(dependencies = {
  platform: import_node_process.platform,
  release: (0, import_node_os.release)(),
  fsAccess: (0, import_node_util.promisify)(import_node_fs.access),
  pathNormalize: import_node_path.normalize,
  pathSep: import_node_path.sep,
  cpExecFile: (0, import_node_util.promisify)(import_node_child_process.execFile)
}) {
  try {
    const { stdout } = await dependencies.cpExecFile(
      "zpool",
      ["list", "-o", "free", "-H"],
      { windowsHide: true }
    );
    const pools = stdout.split("\n").map((line) => line.trim()).filter((line) => line.length !== 0);
    if (pools.length === 0) {
      return null;
    }
    const freeSpace = pools[0];
    return parseInt(freeSpace, 10);
  } catch (error) {
    return null;
  }
}
var src_default = checkDiskSpace;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InvalidPathError,
  NoMatchError,
  checkZfsPool,
  getFirstExistingParentPath
});
