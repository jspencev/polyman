import { isFile } from "@jspencev/node-util";
import { hashFile } from "%/util";
import thenify from "thenify";
import _glob from "glob";
const glob = thenify(_glob);
import path from "path";
import hashObj from "hash-obj";
import thenifyAll from "thenify-all";
import _fs from "fs";
const fs = thenifyAll(_fs);
import ignore from "ignore";

export default async function hashDirectory(dir, filter) {
  let gitignore = await fs.readFile(path.resolve(dir, ".gitignore"));
  gitignore = gitignore.toString();
  gitignore = ignore().add(gitignore);

  if (!path.isAbsolute(dir)) {
    throw Error(`Directory path must be absolute. Yours: ${dir}`);
  }

  let files = await glob(path.join(dir, "**", "*"), {
    dot: true,
  });

  const hashPromises = [];
  for (const filepath of files) {
    const relFilepath = path.relative(dir, filepath);
    let filtered = true;
    if (filter) {
      filtered = filter(filepath);
    }

    if (
      (await isFile(filepath)) &&
      !(gitignore.ignores(relFilepath) || relFilepath.includes(".git")) &&
      filtered
    ) {
      hashPromises.push(hashFilePromise(filepath, relFilepath));
    }
  }

  const hashRes = await Promise.all(hashPromises);
  const hashes = {};
  for (const r of hashRes) {
    hashes[r.file] = r.hash;
  }

  const options = {
    encoding: "base64",
    algorithm: "md5",
  };
  const hash = hashObj(hashes, options);
  return hash;
}

async function hashFilePromise(filepath, relFilepath) {
  return {
    file: relFilepath,
    hash: await hashFile(filepath),
  };
}
