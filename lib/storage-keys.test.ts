import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getJoinedRooms,
  addJoinedRoom,
  removeJoinedRoom,
  isRoomJoined,
  JOINED_ROOMS_KEY,
} from "./storage-keys";

const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
const mockRemoveItem = vi.fn();

describe("storage-keys", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: mockGetItem,
          setItem: mockSetItem,
          removeItem: mockRemoveItem,
        },
      },
      writable: true,
    });
    mockGetItem.mockReturnValue(null);
    mockSetItem.mockClear();
  });

  it("getJoinedRooms returns empty array when no storage", () => {
    mockGetItem.mockReturnValue(null);
    expect(getJoinedRooms()).toEqual([]);
  });

  it("getJoinedRooms returns empty array when invalid JSON", () => {
    mockGetItem.mockReturnValue("not json");
    expect(getJoinedRooms()).toEqual([]);
  });

  it("getJoinedRooms returns parsed array when valid", () => {
    mockGetItem.mockReturnValue(JSON.stringify(["Room A", "Room B"]));
    expect(getJoinedRooms()).toEqual(["Room A", "Room B"]);
  });

  it("getJoinedRooms filters non-strings", () => {
    mockGetItem.mockReturnValue(JSON.stringify(["Room A", 1, null, "Room B"]));
    expect(getJoinedRooms()).toEqual(["Room A", "Room B"]);
  });

  it("addJoinedRoom adds room and persists", () => {
    mockGetItem.mockReturnValue(JSON.stringify(["Room A"]));
    addJoinedRoom("Room B");
    expect(mockSetItem).toHaveBeenCalledWith(
      JOINED_ROOMS_KEY,
      JSON.stringify(["Room A", "Room B"])
    );
  });

  it("addJoinedRoom does not duplicate", () => {
    mockGetItem.mockReturnValue(JSON.stringify(["Room A"]));
    addJoinedRoom("Room A");
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("removeJoinedRoom removes and persists", () => {
    mockGetItem.mockReturnValue(JSON.stringify(["Room A", "Room B"]));
    removeJoinedRoom("Room A");
    expect(mockSetItem).toHaveBeenCalledWith(
      JOINED_ROOMS_KEY,
      JSON.stringify(["Room B"])
    );
  });

  it("isRoomJoined returns true when room in list", () => {
    mockGetItem.mockReturnValue(JSON.stringify(["Room A"]));
    expect(isRoomJoined("Room A")).toBe(true);
    expect(isRoomJoined("Room B")).toBe(false);
  });
});
