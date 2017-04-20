#pragma once

#include <memory>
#include <string>
#include <vector>

struct PlatformMutex {
  virtual ~PlatformMutex();
};
struct PlatformScopedMutexLock {
  virtual ~PlatformScopedMutexLock();
};
struct PlatformSharedMemory {
  virtual ~PlatformSharedMemory();
  void* data;
  size_t capacity;
  std::string name;
};

std::unique_ptr<PlatformMutex> CreatePlatformMutex(const std::string& name);
std::unique_ptr<PlatformScopedMutexLock> CreatePlatformScopedMutexLock(
    PlatformMutex* mutex);
std::unique_ptr<PlatformSharedMemory> CreatePlatformSharedMemory(
    const std::string& name,
    size_t size);

void PlatformInit();

std::string GetWorkingDirectory();
std::string NormalizePath(const std::string& path);
// Creates a directory at |path|. Creates directories recursively if needed.
void MakeDirectoryRecursive(std::string path);
// Tries to create the directory given by |absolute_path|. Returns true if
// successful or if the directory already exists. Returns false otherwise. This
// does not attempt to recursively create directories.
bool TryMakeDirectory(const std::string& absolute_path);

void SetCurrentThreadName(const std::string& thread_name);

int64_t GetLastModificationTime(const std::string& absolute_path);

// Returns any clang arguments that are specific to the current platform.
std::vector<std::string> GetPlatformClangArguments();