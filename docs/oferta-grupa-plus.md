---
title: "System Zarządzania Produkcją Drukarską"
subtitle: "Oferta wdrożeniowa dla Drukarni Grupa Plus"
author: "Akonda"
date: "19 czerwca 2026"
---

# 1. Wprowadzenie

Niniejszy dokument przedstawia zakres systemu zarządzania produkcją dla Drukarni Grupa Plus z siedzibą w Sanoku. Opracowanie powstało na podstawie spotkania wdrożeniowego z 18 czerwca 2026.

Drukarnia Grupa Plus to firma z ponad 25-letnią tradycją, specjalizująca się w druku cyfrowym małego i dużego formatu. Park maszynowy obejmuje maszyny flagowe Fuji Revoria, Konica Minolta i Canon, plotery UV, laminatory, gilotyny, maszynę do złoceń Acurio Shine oraz sprzęt do DTF. Firma realizuje szeroką gamę produktów — wizytówki, plakaty, banery, ulotki, naklejki, książki, kubki, długopisy i wiele innych.

Głównym źródłem zamówień jest Allegro (konto Firma_Plus, status Super Sprzedawca, około 150 ofert, kilkadziesiąt zamówień dziennie). Dodatkowe źródła to sklep internetowy sklep.grupa-plus.pl oraz zamówienia stacjonarne, e-mailowe i telefoniczne.


# 2. Problem

Obecny proces zarządzania zamówieniami jest w całości ręczny. Recepcja kopiuje dane z Allegro, tworzy foldery z datą na dysku sieciowym, wkleja miniaturki do Worda, drukuje kartki i nosi je po hali produkcyjnej. Brak jest jakiegokolwiek wglądu w status produkcji — pracownice recepcji muszą fizycznie chodzić po hali i pytać operatorów, co jest gotowe. Przy rosnącej skali zamówień ten proces generuje chaos i błędy.

Właściciel firmy jasno określił oczekiwania: prosty, działający szkielet, który będzie stopniowo rozbudowywany. System ma ułatwić życie w 90% przypadków, bez nadmiernej komplikacji.


# 3. Zakres systemu

## 3.1 Zamówienia

System agreguje zamówienia z wielu źródeł w jednym miejscu. Sklep internetowy podłączony jest automatycznie — każde opłacone zamówienie trafia do systemu bez udziału recepcji. Zamówienia stacjonarne, e-mailowe i telefoniczne wprowadzane są ręcznie przez prosty formularz z wyszukiwaniem istniejących firm i kontaktów.

Każde zamówienie przechodzi przez kontrolowane statusy: nowe, potwierdzone, w produkcji, gotowe, wysłane, dostarczone. Zmiana statusu jest zabezpieczona — nie można przeskoczyć etapu. Zamówienie można przypisać do konkretnego operatora odpowiedzialnego za realizację.

## 3.2 Produkcja

Panel produkcji to tablica aktualizowana w czasie rzeczywistym. Kolumny odpowiadają etapom produkcji (weryfikacja, druk, laminowanie, cięcie, pakowanie i inne), a karty to poszczególne pozycje zamówień. Gdy operator oznaczy etap jako ukończony, tablica automatycznie się odświeża na wszystkich urządzeniach — bez potrzeby ręcznego odświeżania.

Pozycje z bliskim lub przekroczonym terminem są wyraźnie oznaczone. Panel pokazuje ile pozycji oczekuje, ile jest w realizacji i ile ma zagrożony termin.

## 3.3 Etapy produkcji

Każdy produkt ma przypisane etapy, przez które musi przejść. Na przykład wizytówka laminowana przechodzi: weryfikację pliku, druk, laminowanie, cięcie i pakowanie. Baner winylowy przechodzi: druk dużego formatu, zgrzewanie/oczkowanie i pakowanie.

Administrator sam definiuje te etapy — może dodawać nowe, usuwać zbędne i zmieniać kolejność. Gdy firma kupi nową maszynę lub zacznie realizować nowy rodzaj produktu, administrator dodaje odpowiednie etapy i przypisuje je do produktu. Nie wymaga to żadnych zmian w kodzie ani interwencji programisty.

Operator na hali odhacza kolejne etapy. System pilnuje kolejności — nie można oznaczyć cięcia jako wykonanego, jeśli druk nie został jeszcze ukończony.

## 3.4 Karta produkcyjna

System generuje papierową kartę produkcyjną z kodem QR. Karta jest podzielona na dwie części. Górna połowa zawiera numer zamówienia, termin realizacji i listę pozycji z etapami do odhaczenia — to część dla produkcji. Dolna połowa zawiera dane klienta, informacje o płatności i metodę wysyłki — tę część można odciąć po zakończeniu produkcji i dołączyć do paczki.

Kod QR po zeskanowaniu telefonem lub skanerem otwiera zamówienie w systemie.

## 3.5 Klienci

System prowadzi bazę klientów. Firma jest nadrzędna, pod nią znajdują się osoby kontaktowe, pod nimi historia zleceń z obrotem. Klient prywatny to kontakt bez przypisanej firmy.

Dla każdej firmy widoczne są: łączna liczba zamówień, obrót i średnia wartość zamówienia. Z poziomu karty firmy można wygenerować ofertę handlową z pozycjami, cenami i sumą, gotową do wydruku lub wysłania.

## 3.6 Pliki i weryfikacja

Recepcja może wrzucać pliki do zamówienia. Przy każdym uploadzie system automatycznie sprawdza plik pod kątem przydatności do druku — rozdzielczość (DPI), wymiary i profil kolorystyczny (RGB vs CMYK). Jeśli plik nie nadaje się do druku, pracownik widzi to od razu i może poprosić klienta o ponowne przesłanie. Cała weryfikacja trwa mniej niż sekundę.

## 3.7 Zgłoszenia incydentów

Gdy na produkcji coś pójdzie nie tak, operator może zgłosić incydent. Wybiera pozycję, wskazuje etap do którego trzeba się cofnąć, podaje ilość arkuszy do dodruku i opisuje problem. System automatycznie cofa etapy produkcji do wskazanego kroku.

Reklamacje od klientów są rejestrowane przy zamówieniu z opisem problemu i statusem realizacji.

## 3.8 Maszyny

Maszyny są zorganizowane w grupy odpowiadające typom procesów: druk małego formatu, druk dużego formatu, laminowanie, cięcie, obróbka i pakowanie. Każda maszyna ma priorytet — na przykład Fuji Revoria ma najwyższy priorytet, bo firma musi wyrobić na niej miesięczny budżet kopii. Administrator dodaje nowe maszyny i grupy przez interfejs.

## 3.9 Kalkulator cen

System zawiera kalkulator do szybkiej wyceny. Dla małego formatu uwzględnia materiał, laminat, druk jedno- lub dwustronny, ilość sztuk i automatyczną marżę zależną od nakładu. Dla dużego formatu liczy cenę za metr kwadratowy. Stawki bazowe są edytowalne przez administratora.

## 3.10 Widok klienta

Klient końcowy widzi uproszczony widok swoich zamówień z czterema statusami: przyjęte do realizacji, w realizacji, wysłane, anulowane. Nie widzi wewnętrznych szczegółów produkcji, etapów ani danych innych klientów.


# 4. Bezpieczeństwo

System stosuje trzy role dostępu. Administrator (recepcja) ma pełny dostęp do wszystkich funkcji. Operator (produkcja) widzi zamówienia i tablicę produkcji, może odhaczać etapy i zgłaszać incydenty. Klient widzi wyłącznie własne zamówienia.

Bezpieczeństwo jest egzekwowane na poziomie bazy danych — nawet gdyby ktoś próbował obejść interfejs, baza danych nie pozwoli na nieautoryzowany dostęp.


# 5. Dalsze możliwości rozbudowy

Integracja Allegro — podłączenie konta Allegro przez integrator (BaseLinker lub podobny), aby zamówienia z Allegro automatycznie trafiały do systemu tak jak ze sklepu internetowego.

Stacje robocze na hali — skanery kodów kreskowych lub tablety przy każdej maszynie. Logowanie operatora kartą identyfikacyjną. Skanowanie kodu QR z karty produkcyjnej zamiast ręcznego odhaczania w systemie.

Fakturowanie — automatyczne wystawianie faktur z systemu przez integrację z programem księgowym.

Automatyczne powiadomienia — maile do klienta przy przyjęciu zamówienia i przy wysyłce. Przypomnienia gdy klient nie odpowiada na projekt do akceptacji.

Zaawansowana weryfikacja plików — szczegółowe sprawdzanie spadów, osadzonych fontów i zgodności wymiarów z zamówionym produktem.

Kalkulator broszur i książek — rozszerzenie kalkulatora o produkty wielostronicowe z uwzględnieniem oprawy, ilości stron i kosztów wykończenia.


---

Dokument przygotowany na podstawie spotkania wdrożeniowego z 18 czerwca 2026.

Akonda, 2026.
