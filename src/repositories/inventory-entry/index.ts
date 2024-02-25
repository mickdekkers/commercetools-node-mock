import type {
	InventoryEntry,
	InventoryEntryDraft,
} from "@commercetools/platform-sdk";
import { getBaseResourceProperties } from "~src/helpers";
import { AbstractStorage } from "~src/storage/abstract";
import {
	AbstractResourceRepository,
	type RepositoryContext,
} from "../abstract";
import { createCustomFields } from "../helpers";
import { InventoryEntryUpdateHandler } from "./actions";

export class InventoryEntryRepository extends AbstractResourceRepository<"inventory-entry"> {
	constructor(storage: AbstractStorage) {
		super("inventory-entry", storage);
		this.actions = new InventoryEntryUpdateHandler(storage);
	}

	create(
		context: RepositoryContext,
		draft: InventoryEntryDraft,
	): InventoryEntry {
		const resource: InventoryEntry = {
			...getBaseResourceProperties(),
			sku: draft.sku,
			quantityOnStock: draft.quantityOnStock,
			availableQuantity: draft.quantityOnStock,
			expectedDelivery: draft.expectedDelivery,
			restockableInDays: draft.restockableInDays,
			supplyChannel: {
				...draft.supplyChannel,
				typeId: "channel",
				id: draft.supplyChannel?.id ?? "",
			},
			custom: createCustomFields(
				draft.custom,
				context.projectKey,
				this._storage,
			),
		};
		return this.saveNew(context, resource);
	}
}
