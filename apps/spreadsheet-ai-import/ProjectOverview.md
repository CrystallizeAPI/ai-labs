Overview

We want to create a XLS/Spreadsheet to Crystallize mass operations file for an import. We want to validate the data and display validation in the glide data grid for verification before the operations file can be created. Part of the validation will be to use the catalogue API in Crystallize to fetch existing data like brands, topics and folders as these should not be created in this import, just referenced. 

Core features

* Drop zone to upload a new XLS file
* Pre defined mapping of fields from XLS template (I will provide the XLS example):
  - Sku	(product variant SKU)
  - Product (as in product name)
  - Variant Name (Product variant name)
  - ERP Title (singleLine component)
  - External partnumber	(singleLine component )
  - Description	(richText component)
  - Related Items (itemRelation component with SKU relations)
  - Vendor (item relation component to Vendor document)
  - Brand (item relation component to Brand document)
  - SEO Title (singleLine component)
  - SEO Description (richText component)
  -	Discovery Keywords (richText component?? need to check)
  - Topics (Leverandører)	(assigned topics)
  - Topics (Properties - Kvalitet)	(assigned topics)
  - Topics (Properties - Posisjon)	(assigned topics)
  - Location top lvl ( first part of the folder location)	
  - Location lvl2 (second part of the folder location)	
  - Location lvl3 (third part of the folder location)
* Fetching existing data from Crystallize Catalogue API
    - Fetching brands to get the name to compare with the data in the XLS cell and to get the ID to use for the operation
    - Fetching vendors to get the name to compare with the data in the XLS cell and to get the ID to use for the operation 
    - Fetch topics to match with the XLS cells to get the topic Ids for the operation
    - Fetch the folder structure to match with the XLS cells. Here it will be the combination of 3 cells with 3 levels of folders. Names on all levels need to match and we will use the lvl3 as the ID for location.
* Validation should be done in the Glide Data Grid. Invalid cells should be marked red
    - All fields are required except:
     * Related items, this is optional. Could be several items, comma separated if more than 1.
     * Topics are optional. But if provided they need to validate with exsiting topics.
* Once all pass validation OR the user select "Skip invalid rows" we get an active button to generate mass operations. The mass operations should be visible in the UI and there should be a download button.

User workflow

1: user uploads XLS file.
2: mapping is and validation is done. 
3: validation result is shown in the data grid spreadsheet UI
4: once validation is done, user clicks "Generate operations"
5: operations are generated and displayed
6: user downloads file

Technical choices 

TypeScript
React
Glide Data Grid
GraphQL POST call to Crystallize to fetch existing data

Data model:

Here is an example of what the user will upload in a spreadsheet (pasted from word in this case here):

Sku	Product	Variant Name	ERP Title	External partnumber	Description	Related Items	Vendor	Brand	SEO Title	SEO Description	Discovery Keywords	Topics (Leverandører)	Topics (Properties - Kvalitet)	Topics (Properties - Posisjon)	Location top lvl	Location lvl2	Location lvl3								
1300001	CTR Bærekule	CTR Bærekule	Bærekule	CB0345	1300001 – Slitesterk CTR bærekule som gir stabil styring og tryggere kjøreopplevelse.		CTR Europe	CTR	CTR Bærekule CB0345 – kvalitet fra Sør‑Korea	CTR bærekule CB0345 for presis styring og jevn fjæring. Slitesterkt kuleledd i OE‑kvalitet for tryggere kjøring.	CTR bærekule, kuleledd, ball joint, forstilling, hjuloppheng, kontrollarm ledd, nedre bærekule, øvre bærekule, opphengskule, styringsledd	CTR	Premium	Foran, begge sider	Bildeler	Hjuloppheng og styring	Bærekuler/opphengskuler								
1300002	CTR Bærekule	CTR Bærekule	Bærekule	CB0347L	1300002 – Robust CTR bærekule som sikrer presis styring og god kontroll over bilen.	1300003	CTR Europe	CTR	CTR Bærekule venstre CB0347L – presis styring	Venstre bærekule fra CTR (CB0347L) for nøyaktig styring og stabilt hjuloppheng. Robust kvalitet for lang levetid.	CTR bærekule venstre, venstre bærekule, kuleledd venstre, ball joint left, LH, CB0347L, forstilling, hjuloppheng, kontrollarm ledd	CTR	Premium	Foran, venstre side	Bildeler	Hjuloppheng og styring	Bærekuler/opphengskuler								
1300003	CTR Bærekule	CTR Bærekule	Bærekule	CB0347R	1300003 – CTR bærekule som gjenoppretter stabilitet i forstilling og reduserer slark.	1300002	CTR Europe	CTR	CTR Bærekule høyre CB0347R – presis styring	Høyre bærekule fra CTR (CB0347R) gir stabilitet og redusert slark i forstilling. Designet for passform og slitestyrke.	CTR bærekule høyre, høyre bærekule, kuleledd høyre, ball joint right, RH, CB0347R, forstilling, hjuloppheng, kontrollarm ledd	CTR	Premium	Foran, høyre side	Bildeler	Hjuloppheng og styring	Bærekuler/opphengskuler								
1300004	CTR Lenkearm	CTR Lenkearm	Lenkearm	CL0518	1300004 – CTR lenkearm som forbedrer stabilitet og reduserer krengning i svinger.		CTR Europe	CTR	CTR Lenkearm CL0518 – stabilisatorlenke	CTR lenkearm (CL0518) for krengningsstag. Bedrer stabilitet i svinger og reduserer støy. Slitesterke ledd.	CTR lenkearm, lenkestag, stabilisatorlenke, sway bar link, krengningsstag lenke, stabstag lenke, anti‑roll link, CL0518	CTR	Premium	Foran, begge sider	Bildeler	Hjuloppheng og styring	Ledd/stag								
1300005	CTR Endeledd	CTR Endeledd	Endeledd v.	CE0613L	1300005 – Presist CTR endeledd som gir bedre styrerespons og riktigere sporing.	1300006	CTR Europe	CTR	CTR Endeledd venstre CE0613L – tie rod end	Venstre endeledd (CE0613L) fra CTR for presis sporing og bedre styrefølelse. OE‑spesifikasjoner.	CTR endeledd venstre, ytre styrekule venstre, tie rod end left, LH, CE0613L, sporingsledd, styrestang endeledd, forstilling	CTR	Premium	Foran, venstre side	Bildeler	Hjuloppheng og styring	Endeledd								
1300006	CTR Endeledd	CTR Endeledd	Endeledd h.	CE0613R	1300006 – CTR endeledd av høy kvalitet som gir trygg og stabil styring.	1300005	CTR Europe	CTR	CTR Endeledd høyre CE0613R – tie rod end	Høyre endeledd (CE0613R) fra CTR gir nøyaktig sporing og redusert slark i styringen.	CTR endeledd høyre, ytre styrekule høyre, tie rod end right, RH, CE0613R, sporingsledd, styrestang endeledd, forstilling	CTR	Premium	Foran, høyre side	Bildeler	Hjuloppheng og styring	Endeledd								
1300007	CTR Styrestag	CTR Styrestag	Styrestag	CR0533	1300007 – Solid CTR styrestag for presis styring og redusert slark i tannstangen.		CTR Europe	CTR	CTR Styrestag CR0533 – indre endeledd	CTR styrestag (CR0533) – indre endeledd/rack end for direkte styrefølelse og holdbarhet under belastning.	CTR styrestag, indre endeledd, rack end, inner tie rod, CR0533, styrestang, styring, forstilling	CTR	Premium	Foran, begge sider	Bildeler	Hjuloppheng og styring	Ledd/stag								
1300008	CTR Endeledd	CTR Endeledd	Endeledd v.	CE0867L	1300008 – CTR endeledd som gjenoppretter styringspresisjon og øker kjørekomforten.	1300009	CTR Europe	CTR	CTR Endeledd venstre CE0867L – presis sporing	Venstre endeledd fra CTR (CE0867L) for stabil styring og jevn dekkslitasje.	CTR endeledd venstre, ytre styrekule venstre, tie rod end left, LH, CE0867L, sporingsledd, styrestang endeledd	CTR	Premium	Foran, venstre side	Bildeler	Hjuloppheng og styring	Endeledd								
1300009	CTR Endeledd	CTR Endeledd	Endeledd h.	CE0867R	1300009 – Kvalitetsendeledd fra CTR som forbedrer styringen og gir jevnere dekkslitasje.	1300008	CTR Europe	CTR	CTR Endeledd høyre CE0867R – presis sporing	Høyre endeledd fra CTR (CE0867R) for sikker styring og korrekt hjulstilling.	CTR endeledd høyre, ytre styrekule høyre, tie rod end right, RH, CE0867R, sporingsledd, styrestang endeledd	CTR	Premium	Foran, høyre side	Bildeler	Hjuloppheng og styring	Endeledd								
1300010	CTR Styrestag	CTR Styrestag	Styrestag	CR0800	1300010 – CTR styrestag som gir direkte styrefølelse og stabil kontroll på veien.		CTR Europe	CTR	CTR Styrestag CR0800 – inner tie rod	CTR styrestag (CR0800) – indre styrekule for presis respons fra tannstang til hjul.	CTR styrestag, indre endeledd, rack end, inner tie rod, CR0800, styrestang, styring	CTR	Premium	Foran, begge sider	Bildeler	Hjuloppheng og styring	Ledd/stag								
1300011	CTR Bærekule	CTR Bærekule	Bærekule	CB0537	1300011 – CTR bærekule som gir bedre stabilitet i opphenget og tryggere kjøring.		CTR Europe	CTR	CTR Bærekule CB0537 – slitesterkt kuleledd	CTR bærekule (CB0537) gir stabil forstilling og reduserer klunkelyder ved ujevnheter.	CTR bærekule, kuleledd, ball joint, kontrollarm ledd, forstilling, hjuloppheng, opphengskule	CTR	Premium	Bak, begge sider	Bildeler	Hjuloppheng og styring	Bærekuler/opphengskuler								
1300012	CTR Lenkearm	CTR Lenkearm	Lenkearm	CL0519	1300012 – Slitesterk CTR lenkearm som forbedrer balanse og kjørestabilitet.		CTR Europe	CTR	CTR Lenkearm CL0519 – sway bar link	CTR lenkearm (CL0519) for krengningsstag. Øker stabilitet og komfort i sving.	CTR lenkearm, lenkestag, stabilisatorlenke, sway bar link, anti‑roll link, krengningsstag lenke, CL0519	CTR	Premium	Foran, begge sider	Bildeler	Hjuloppheng og styring	Ledd/stag								
1300013	CTR Lenkearm	CTR Lenkearm	Lenkearm	CL0393	1300013 – CTR lenkearm som gir stødigere hjuloppheng og økt kjørekvalitet.		CTR Europe	CTR	CTR Lenkearm CL0393 – stabilisatorlenke	Lenkearm fra CTR (CL0393) for effektiv kontroll av krengning. Slitestyrke i fokus.	CTR lenkearm, lenkestag, stabilisatorlenke, sway bar link, krengningsstag lenke, stabstag lenke, CL0393	CTR	Premium	Bak, begge sider	Bildeler	Hjuloppheng og styring	Ledd/stag								
1300014	CTR Lenkearm	CTR Lenkearm	Lenkearm	CL0397	1300014 – Kraftig CTR lenkearm som forbedrer respons og komfort i hjulopphenget.		CTR Europe	CTR	CTR Lenkearm CL0397 – stabilisatorlenke	CTR CL0397 lenkearm for krengningsstag – stabilitet, komfort og redusert støy.	CTR lenkearm, lenkestag, stabilisatorlenke, sway bar link, anti‑roll link, krengningsstag lenke, CL0397	CTR	Premium	Bak, begge sider	Bildeler	Hjuloppheng og styring	Ledd/stag								
1300015	CTR Bærearm	CTR Bærearm	Bærearm	CQ0238L	1300015 – Robust CTR bærearm som sikrer riktig hjulvinkel og stabil kjøring.	1300016	CTR Europe	CTR	CTR Bærearm venstre CQ0238L – kontrollarm	Venstre bærearm (CQ0238L) fra CTR. Robust kontrollarm for korrekt hjulvinkel og komfort.	CTR bærearm venstre, venstre kontrollarm, wishbone left, LH, triangelarm, bærebru, CQ0238L, hjuloppheng	CTR	Premium	Foran, venstre side	Bildeler	Hjuloppheng og styring	Bærearmer/opphengsarmer								
1300016	CTR Bærearm	CTR Bærearm	Bærearm	CQ0238R	1300016 – Slitesterk CTR bærearm som gjenoppretter kontroll og stabilitet i opphenget.	1300015	CTR Europe	CTR	CTR Bærearm høyre CQ0238R – kontrollarm	Høyre bærearm (CQ0238R) fra CTR for riktig camber/caster og stabil kjøring.	CTR bærearm høyre, høyre kontrollarm, wishbone right, RH, triangelarm, bærebru, CQ0238R, hjuloppheng	CTR	Premium	Foran, høyre side	Bildeler	Hjuloppheng og styring	Bærearmer/opphengsarmer								
1300017	CTR Bærearmsforing	GTR Bærearmsforing	Bærearmsforing	GV0051	1300017 – CTR bærearmsforing som demper vibrasjoner og gir mer komfortabel kjøring.		CTR Europe	CTR	CTR Bærearmsforing GV0051 – silentblock	CTR bærearmsforing (GV0051) demper vibrasjoner og gir strammere oppheng. Slitesterk silentblock.	CTR bærearmsforing, kontrollarmsforing, armforing, silentblock, hydroforing, foring bærearm, GV0051, hjuloppheng	CTR	Premium	Foran, begge sider	Bildeler	Hjuloppheng og styring	Bærearmer/opphengsarmer								
1300018	CTR stabstagsforing	GTR Stabstagsforing	Stabstagsforing	GV0379	1300018 – CTR stabstagsforing som reduserer støy og gir bedre stabilitet i svinger.		CTR Europe	CTR	CTR Stabstagsforing GV0379 – stabilisatorforing	CTR stabstagsforing (GV0379) for krengningsstag. Reduserer støy og forbedrer stabilitet.	CTR stabstagsforing, stabilisatorforing, anti‑roll bar bushing, sway bar bushing, krengningsstag foring, GV0379, oppheng	CTR	Premium	Bak, begge sider	Bildeler	Hjuloppheng og styring	Foring								 


Input/Output

Input: XLS/Spreadsheet file with the data model as above
Output: Crystallize mass operations file for import. Language should be "no"

Crystallize shapes:

All shapes can be found in the file shapes/model.json
We want to use the following shapes:
* Product (product) - Product shape
* Folder (folder) - Folder shape
* Brand (brand) - Document shape
* Vendor (vendor) - Document shape


GraphQL Post Queries to Crystallize Catalogue API:

Crystallize API needs headers for authentication:
  -H "X-Crystallize-Access-Token-Id: [your-crystallize-token-id]" \
  -H "X-Crystallize-Access-Token-Secret: [your-crystallize-token-secret]" \

Tokens should be stored in environment variables.

Endpoint for Catalogue API:
https://api.crystallize.com/staging-motor-part-as/catalogue

Fetch Vendors:
```query FetchVendors{
  catalogue(path:"/motorpart/leverandor",language: "no"){
    id
    name
    children{
      id
      name
    }    
  }
}```

Fetch Brands:

```query FetchBrands{
  catalogue(path:"/motorpart/merker",language: "no"){
    id
    name
    children{
      id
      name
    }    
  }
}```

Fetch Topics:

```query FetchTopics {
  topics(language: "no") {
    id
    name
    path
    children {
      id
      name
      path
      children {
        id
        name
        path
        children {
          id
          name
          path
          children {
            id
            name
            path
          }
        }
      }
    }
  }
}   ```


Fetch Category Folders:

```query FetchCategories {
  catalogue(path: "/motorpart/produkter", language: "no") {
    id
    name
    subtree(type: folder) {
      edges {
        node {
          id
          name
          subtree(type: folder) {
            edges {
              node {
                id
                name
                subtree(type: folder) {
                  edges {
                    node {
                      id
                      name
                      subtree(type: folder) {
                        edges {
                          node {
                            id
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}```


Here is an of a valid mass operations file:

{
  "version": "0.0.1",
  "operations": [
    {
      "_ref": "rootCategory",
      "intent": "folder/upsert",
      "resourceIdentifier": "product-category",
      "language": "en",
      "shapeIdentifier": "folder",
      "name": "Products",
      "tree": {
        "parentId": "{{ defaults.rootItemId }}"
      },
      "components": []
    },
    {
      "_ref": "folder1",
      "intent": "folder/upsert",
      "resourceIdentifier": "folder-1-flugfiske",
      "language": "en",
      "shapeIdentifier": "folder",
      "name": "Flugfiske",
      "tree": {
        "parentId": "{{ rootCategory.id }}"
      },
      "components": []
    },
    {
      "_ref": "folder2",
      "intent": "folder/upsert",
      "resourceIdentifier": "folder-2-flugor",
      "language": "en",
      "shapeIdentifier": "folder",
      "name": "Flugor",
      "tree": {
        "parentId": "{{ folder1.id }}"
      },
      "components": []
    },
    {
      "_ref": "folder3",
      "intent": "folder/upsert",
      "resourceIdentifier": "folder-3-vatflugor",
      "language": "en",
      "shapeIdentifier": "folder",
      "name": "Våtflugor",
      "tree": {
        "parentId": "{{ folder2.id }}"
      },
      "components": []
    },
    {
      "_ref": "folder4",
      "intent": "folder/upsert",
      "resourceIdentifier": "folder-4-kustflugor",
      "language": "en",
      "shapeIdentifier": "folder",
      "name": "Kustflugor",
      "tree": {
        "parentId": "{{ folder2.id }}"
      },
      "components": []
    },
    {
      "_ref": "p1",
      "intent": "product/upsert",
      "resourceIdentifier": "product-101295gl",
      "language": "en",
      "shapeIdentifier": "product",
      "name": "Prince Nymph Gold Bead - 12",
      "tree": {
        "parentId": "{{ folder3.id }}"
      },
      "components": [
        {
          "componentId": "title",
          "singleLine": {
            "text": "Prince Nymph Gold Bead - 12"
          }
        },
        {
          "componentId": "description",
          "richText": {
            "json": [
              {
                "kind": "block",
                "type": "paragraph",
                "textContent": "Prince Nymph Gold Bead, nymf till öring och harr, fiskas med fördel hela säsongen och gärna i älv, tjärn och insjöar. Ska imitera en bäckslända eller nattslända."
              }
            ]
          }
        }
      ],
      "vatTypeId": "{{ defaults.vatTypeIds.[0] }}",
      "variants": [
        {
          "name": "Prince Nymph Gold Bead - 12 Variant",
          "sku": "101295GL",
          "isDefault": true,
          "images": [
            {
              "key": "{{ upload \"https://www.sportfishtackle.no/bilder/artiklar/101295GL.jpg\" }}"
            }
          ],
          "priceVariants": [
            {
              "identifier": "default",
              "price": 28
            }
          ]
        }
      ]
    },
    {
      "_ref": "p2",
      "intent": "product/upsert",
      "resourceIdentifier": "product-101294gl",
      "language": "en",
      "shapeIdentifier": "product",
      "name": "Prince Nymph Gold Bead - 10",
      "tree": {
        "parentId": "{{ folder4.id }}"
      },
      "components": [
        {
          "componentId": "title",
          "singleLine": {
            "text": "Prince Nymph Gold Bead - 10"
          }
        },
        {
          "componentId": "description",
          "richText": {
            "json": [
              {
                "kind": "block",
                "type": "paragraph",
                "textContent": "Prince Nymph Gold Bead, nymf till öring och harr, fiskas med fördel hela säsongen och gärna i älv, tjärn och insjöar. Ska imitera en bäckslända eller nattslända."
              }
            ]
          }
        }
      ],
      "vatTypeId": "{{ defaults.vatTypeIds.[0] }}",
      "variants": [
        {
          "name": "Prince Nymph Gold Bead - 10 Variant",
          "sku": "101294GL",
          "isDefault": true,
          "images": [
            {
              "key": "{{ upload \"https://www.sportfishtackle.no/bilder/artiklar/101294GL.jpg\" }}"
            }
          ],
          "priceVariants": [
            {
              "identifier": "default",
              "price": 28
            }
          ]
        }
      ]
    },
    {
      "_ref": "p3",
      "intent": "product/upsert",
      "resourceIdentifier": "product-101287gl",
      "language": "en",
      "shapeIdentifier": "product",
      "name": "Copper John Red Nymfe Beadhead - 16",
      "tree": {
        "parentId": "{{ folder4.id }}"
      },
      "components": [
        {
          "componentId": "title",
          "singleLine": {
            "text": "Copper John Red Nymfe Beadhead - 16"
          }
        },
        {
          "componentId": "description",
          "richText": {
            "json": [
              {
                "kind": "block",
                "type": "paragraph",
                "textContent": "Copper John Red Nymfe Beadhead, nymf-fluga för hela säsongens fiske efter harr och öring. Väldigt allround för olika typer av vatten och ska imitera en dagslända eller bäckslända."
              }
            ]
          }
        }
      ],
      "vatTypeId": "{{ defaults.vatTypeIds.[0] }}",
      "variants": [
        {
          "name": "Copper John Red Nymfe Beadhead - 16 Variant",
          "sku": "101287GL",
          "isDefault": true,
          "images": [
            {
              "key": "{{ upload \"https://www.sportfishtackle.no//bilder/artiklar/101287GL.jpg\" }}"
            }
          ],
          "priceVariants": [
            {
              "identifier": "default",
              "price": 28
            }
          ]
        }
      ]
    },
    {
      "_ref": "p4",
      "intent": "product/upsert",
      "resourceIdentifier": "product-101286gl",
      "language": "en",
      "shapeIdentifier": "product",
      "name": "Copper John Red Nymfe Beadhead - 14",
      "tree": {
        "parentId": "{{ folder3.id }}"
      },
      "components": [
        {
          "componentId": "title",
          "singleLine": {
            "text": "Copper John Red Nymfe Beadhead - 14"
          }
        },
        {
          "componentId": "description",
          "richText": {
            "json": [
              {
                "kind": "block",
                "type": "paragraph",
                "textContent": "Copper John Red Nymfe Beadhead, nymf-fluga för hela säsongens fiske efter harr och öring. Väldigt allround för olika typer av vatten och ska imitera en dagslända eller bäckslända."
              }
            ]
          }
        }
      ],
      "vatTypeId": "{{ defaults.vatTypeIds.[0] }}",
      "variants": [
        {
          "name": "Copper John Red Nymfe Beadhead - 14 Variant",
          "sku": "101286GL",
          "isDefault": true,
          "images": [
            {
              "key": "{{ upload \"https://www.sportfishtackle.no/bilder/artiklar/101286GL.jpg\" }}"
            }
          ],
          "priceVariants": [
            {
              "identifier": "default",
              "price": 28
            }
          ]
        }
      ]
    },
    {
      "intent": "item/updateComponent/item",
      "itemId": "{{ p1.id }}",
      "language": "en",
      "component": {
        "componentId": "related-products",
        "itemRelations": {
          "itemIds": [],
          "skus": [
            "101287GL"
          ]
        }
      }
    },
    {
      "intent": "item/updateComponent/item",
      "itemId": "{{ p2.id }}",
      "language": "en",
      "component": {
        "componentId": "related-products",
        "itemRelations": {
          "itemIds": [],
          "skus": [
            "101286GL"
          ]
        }
      }
    },
    {
      "intent": "item/updateComponent/item",
      "itemId": "{{ p3.id }}",
      "language": "en",
      "component": {
        "componentId": "related-products",
        "itemRelations": {
          "itemIds": [],
          "skus": [
            "101287GL"
          ]
        }
      }
    },
    {
      "intent": "item/updateComponent/item",
      "itemId": "{{ p4.id }}",
      "language": "en",
      "component": {
        "componentId": "related-products",
        "itemRelations": {
          "itemIds": [],
          "skus": [
            "101286GL"
          ]
        }
      }
    },
    {
      "intent": "item/publish",
      "itemId": "{{ rootCategory.id }}",
      "language": "en"
    },
    {
      "intent": "item/publish",
      "itemId": "{{ folder1.id }}",
      "language": "en"
    },
    {
      "intent": "item/publish",
      "itemId": "{{ folder2.id }}",
      "language": "en"
    },
    {
      "intent": "item/publish",
      "itemId": "{{ folder3.id }}",
      "language": "en"
    },
    {
      "intent": "item/publish",
      "itemId": "{{ folder4.id }}",
      "language": "en"
    },
    {
      "intent": "item/publish",
      "itemId": "{{ p1.id }}",
      "language": "en"
    },
    {
      "intent": "item/publish",
      "itemId": "{{ p2.id }}",
      "language": "en"
    },
    {
      "intent": "item/publish",
      "itemId": "{{ p3.id }}",
      "language": "en"
    },
    {
      "intent": "item/publish",
      "itemId": "{{ p4.id }}",
      "language": "en"
    }
  ]
}
