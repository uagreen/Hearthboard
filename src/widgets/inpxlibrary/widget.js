import credentialedProxyHandler from "utils/proxy/handlers/credentialed";

const widget = {
  api: "{url}/{endpoint}",
  proxyHandler: credentialedProxyHandler,

  mappings: {
    // public
    IndexStatus: {
      endpoint: "api/index-status",
    },
    // per user (HTTP Basic with the library user's own login)
    Reading: {
      endpoint: "api/library/continue",
      params: ["pageSize"],
    },
    Want: {
      endpoint: "api/library/want",
      params: ["pageSize"],
    },
    Shelves: {
      endpoint: "api/shelves",
    },
    ShelfBooks: {
      endpoint: "api/shelves/{shelfId}/books",
      segments: ["shelfId"],
    },
  },
};

export default widget;
