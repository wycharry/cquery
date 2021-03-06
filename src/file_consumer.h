#pragma once

#include "utils.h"

#include <clang-c/Index.h>

#include <functional>
#include <mutex>
#include <unordered_set>
#include <unordered_map>

struct IndexedFile;

// Needed for unordered_map usage below.
MAKE_HASHABLE(CXFileUniqueID, t.data[0], t.data[1], t.data[2]);
bool operator==(const CXFileUniqueID& a, const CXFileUniqueID& b);

// FileConsumer is used by the indexer. When it encouters a file, it tries to
// take ownership over it. If the indexer has ownership over a file, it will
// produce an index, otherwise, it will emit nothing for that declarations
// and references coming from that file.
//
// The indexer does this because header files do not have their own translation
// units but we still want to index them.
struct FileConsumer {
  struct SharedState {
    mutable std::unordered_set<std::string> files;
    mutable std::mutex mutex;

    // Mark the file as used. Returns true if the file was not previously used.
    bool Mark(const std::string& file);
    // Reset the used state (ie, mark the file as unused).
    void Reset(const std::string& file);
  };

  FileConsumer(SharedState* shared_state);

  // Returns true if this instance owns given |file|. This will also attempt to
  // take ownership over |file|.
  //
  // Returns IndexedFile for the file or nullptr. |is_first_ownership| is set
  // to true iff the function just took ownership over the file. Otherwise it
  // is set to false.
  IndexedFile* TryConsumeFile(CXFile file, bool* is_first_ownership);

  // Forcibly create a local file, even if it has already been parsed.
  IndexedFile* ForceLocal(CXFile file);

  // Returns and passes ownership of all local state.
  std::vector<std::unique_ptr<IndexedFile>> TakeLocalState();

 private:
  std::unordered_map<CXFileUniqueID, std::unique_ptr<IndexedFile>> local_;
  SharedState* shared_;
};