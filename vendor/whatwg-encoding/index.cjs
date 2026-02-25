"use strict";

const {
  getBOMEncoding: getBOMEncodingFromBytes,
  labelToName: labelToNameFromBytes,
  legacyHookDecode
} = require("@exodus/bytes/encoding.js");

const toSupportedName = (value) => {
  const input = String(value ?? "").trim();
  if (!input) {
    return null;
  }

  const mapped = labelToNameFromBytes(input);
  if (mapped === null) {
    return null;
  }

  // Keep compatibility with whatwg-encoding behavior: "replacement" is not decodable.
  if (String(mapped).trim().toLowerCase() === "replacement") {
    return null;
  }

  return mapped;
};

exports.labelToName = (label) => {
  return toSupportedName(label);
};

exports.decode = (uint8Array, fallbackEncodingName) => {
  const encoding = toSupportedName(fallbackEncodingName);
  if (encoding === null) {
    throw new RangeError(`"${fallbackEncodingName}" is not a supported encoding name`);
  }

  return legacyHookDecode(uint8Array, encoding);
};

exports.getBOMEncoding = (uint8Array) => {
  const encoding = getBOMEncodingFromBytes(uint8Array);
  if (encoding === null) {
    return null;
  }

  return encoding.toUpperCase();
};

exports.isSupported = (name) => {
  return toSupportedName(name) !== null;
};
